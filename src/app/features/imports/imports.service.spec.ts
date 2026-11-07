import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ImportItem, importErrorMessage } from './import.model';
import { ImportsService } from './imports.service';

const baseUrl = `${environment.apiUrl}/imports`;
const file = new File(['isbn\n9780306406157\n'], 'libros.csv', { type: 'text/csv' });

describe('ImportsService', () => {
  let service: ImportsService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ImportsService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('analyzes the file in multipart, without creating anything', () => {
    let result: unknown;
    service
      .analyze({ file, libraryId: 'l1', isbnColumns: [2, 0] })
      .subscribe((analysis) => (result = analysis));

    const req = backend.expectOne((r) => r.url === baseUrl && r.params.get('dryRun') === 'true');
    const body = req.request.body as FormData;
    expect(req.request.method).toBe('POST');
    expect(body.get('libraryId')).toBe('l1');
    expect(body.getAll('isbnColumns')).toEqual(['2', '0']);
    expect((body.get('file') as File).name).toBe('libros.csv');
    req.flush({ results: { type: 'import-analysis', attributes: { isbnColumns: [2, 0] } } });

    expect(result).toEqual({ isbnColumns: [2, 0] });
  });

  it('creates an import, flattening the response', () => {
    let result: unknown;
    service.create({ file, libraryId: 'l1' }).subscribe((created) => (result = created));

    const req = backend.expectOne(baseUrl);
    const body = req.request.body as FormData;
    expect(req.request.params.has('dryRun')).toBe(false);
    expect(body.get('libraryId')).toBe('l1');
    expect(body.has('isbnColumns')).toBe(false);
    req.flush(
      { results: { type: 'imports', id: 'i1', attributes: { libraryId: 'l1' } } },
      { status: 202, statusText: 'Accepted' },
    );

    expect(result).toEqual({ id: 'i1', libraryId: 'l1' });
  });

  it('lists the imports of a library', () => {
    let result: unknown;
    service.listByLibrary('l1', { skip: 0, limit: 1 }).subscribe((page) => (result = page));

    const req = backend.expectOne(
      (r) =>
        r.url === baseUrl && r.params.get('libraryId') === 'l1' && r.params.get('limit') === '1',
    );
    req.flush({
      results: [{ type: 'imports', id: 'i1', attributes: { status: 'completed' } }],
      paginationInfo: { skip: 0, limit: 1, total: 3 },
    });

    expect(result).toEqual({ items: [{ id: 'i1', status: 'completed' }], total: 3 });
  });

  it('filters the rows by pending only when asked to', () => {
    service.listItems('i1', { skip: 12, limit: 12, pending: true }).subscribe();
    service.listItems('i1', { skip: 0, limit: 12 }).subscribe();

    const [pending, all] = backend.match((r) => r.url === `${baseUrl}/i1/items`);
    expect(pending.request.params.get('pending')).toBe('true');
    expect(pending.request.params.get('skip')).toBe('12');
    expect(all.request.params.has('pending')).toBe(false);
    pending.flush({ results: [], paginationInfo: { skip: 12, limit: 12, total: 0 } });
    all.flush({ results: [], paginationInfo: { skip: 0, limit: 12, total: 0 } });
  });

  it('filters the rows by outcome only when asked to', () => {
    service.listItems('i1', { skip: 0, limit: 12, outcome: 'duplicate_in_file' }).subscribe();
    service.listItems('i1', { skip: 12, limit: 12 }).subscribe();

    const [filtered, all] = backend.match((r) => r.url === `${baseUrl}/i1/items`);
    expect(filtered.request.params.get('outcome')).toBe('duplicate_in_file');
    expect(all.request.params.has('outcome')).toBe(false);
    filtered.flush({ results: [], paginationInfo: { skip: 0, limit: 12, total: 0 } });
    all.flush({ results: [], paginationInfo: { skip: 12, limit: 12, total: 0 } });
  });

  it('collects the pending rows of all the pages', () => {
    const row = (id: string) => ({ type: 'import-items', id, attributes: {} });
    const rows = Array.from({ length: 100 }, (_, index) => row(`r${index}`));
    let result: ImportItem[] = [];
    service.listAllPending('i1').subscribe((items) => (result = items));

    const first = backend.expectOne((r) => r.params.get('skip') === '0');
    expect(first.request.params.get('limit')).toBe('100');
    expect(first.request.params.get('pending')).toBe('true');
    first.flush({ results: rows, paginationInfo: { skip: 0, limit: 100, total: 101 } });
    backend
      .expectOne((r) => r.params.get('skip') === '100')
      .flush({ results: [row('last')], paginationInfo: { skip: 100, limit: 100, total: 101 } });

    expect(result).toHaveLength(101);
    expect(result[100].id).toBe('last');
  });

  it('updates the resolution of a row, also to undo it', () => {
    service.updateItem('i1', 'r1', null).subscribe();

    const req = backend.expectOne(`${baseUrl}/i1/items/r1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ resolution: null });
    req.flush({ results: { type: 'import-items', id: 'r1', attributes: {} } });
  });

  it('retries an import', () => {
    service.retry('i1').subscribe();

    const req = backend.expectOne(`${baseUrl}/i1/retry`);
    expect(req.request.method).toBe('POST');
    req.flush({ results: { type: 'imports', id: 'i1', attributes: {} } });
  });

  it('converts the errors to ApiError', () => {
    let error: unknown;
    service.get('i1').subscribe({ error: (e: unknown) => (error = e) });

    backend
      .expectOne(`${baseUrl}/i1`)
      .flush(
        { message: 'import not found', errorCode: 'NOT FOUND ERROR' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(404);
  });
});

describe('importErrorMessage', () => {
  it.each([
    ['IMPORT TOO MANY ROWS', 400, '200 filas'],
    ['IMPORT FILE TOO LARGE', 413, '5 MB'],
    ['IMPORT ALREADY ACTIVE', 409, 'en curso'],
    ['INVALID IMPORT FILE', 400, 'CSV'],
  ])('explains %s in Spanish', (code, status, text) => {
    expect(importErrorMessage(new ApiError(status, code, 'in english'))).toContain(text);
  });

  it('explains a request that did not reach the backend', () => {
    expect(importErrorMessage(new ApiError(0, null, 'Http failure'))).toContain('conexión');
  });
});
