import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { SharedLibrariesService } from './shared-libraries.service';
import { SharedLibrary } from './shared-library.model';

describe('SharedLibrariesService', () => {
  const url = `${environment.apiUrl}/shared-libraries`;
  const library = { name: 'Novela', ownerName: 'Ana', booksCount: 2 };
  const book = { bookTitle: 'Rossiya', ownerRating: 9, own: null };
  let service: SharedLibrariesService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SharedLibrariesService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists the libraries as flat models with pagination', () => {
    let result: unknown;
    service.list({ skip: 12, limit: 12 }).subscribe((page) => (result = page));

    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.params.get('skip')).toBe('12');
    expect(req.request.params.get('limit')).toBe('12');
    req.flush({
      results: [{ type: 'shared-libraries', id: 'l1', attributes: library }],
      paginationInfo: { skip: 12, limit: 12, total: 13 },
    });

    expect(result).toEqual({ items: [{ id: 'l1', ...library }], total: 13 });
  });

  it('searches the libraries only if there is a search', () => {
    service.list({ skip: 0, limit: 12, search: ' ana ' }).subscribe();
    service.list({ skip: 0, limit: 12, search: ' ' }).subscribe();

    const [searched, all] = backend.match((r) => r.url === url);
    expect(searched.request.params.get('search')).toBe('ana');
    expect(all.request.params.has('search')).toBe(false);
  });

  it('keeps only the libraries of an owner', () => {
    service.list({ skip: 0, limit: 12, ownerId: 'u1' }).subscribe();
    service.list({ skip: 0, limit: 12, ownerId: '' }).subscribe();

    const [filtered, all] = backend.match((r) => r.url === url);
    expect(filtered.request.params.get('owner')).toBe('u1');
    expect(all.request.params.has('owner')).toBe(false);
  });

  it('lists the owners', () => {
    let result: unknown;
    service.listOwners().subscribe((owners) => (result = owners));

    const req = backend.expectOne((r) => r.url === `${url}/owners`);
    expect(req.request.params.toString()).toBe('skip=0&limit=100');
    req.flush({
      results: [
        { type: 'shared-library-owners', id: 'u1', attributes: { name: 'Ana', librariesCount: 2 } },
      ],
      paginationInfo: { skip: 0, limit: 100, total: 1 },
    });

    expect(result).toEqual([{ id: 'u1', name: 'Ana', librariesCount: 2 }]);
  });

  it('gets a library', () => {
    let result: unknown;
    service.get('l1').subscribe((value) => (result = value));

    backend
      .expectOne(`${url}/l1`)
      .flush({ results: { type: 'shared-libraries', id: 'l1', attributes: library } });

    expect(result).toEqual({ id: 'l1', ...library });
  });

  it('lists the books of a library, with the search only if there is one', () => {
    let result: unknown;
    service
      .listBooks('l1', { skip: 0, limit: 12, search: ' ros ' })
      .subscribe((page) => (result = page));
    service.listBooks('l1', { skip: 0, limit: 12, search: '' }).subscribe();

    const [searched, all] = backend.match((r) => r.url === `${url}/l1/books`);
    expect(searched.request.params.get('search')).toBe('ros');
    expect(all.request.params.has('search')).toBe(false);
    const response = {
      results: [{ type: 'shared-library-books', id: 'b1', attributes: book }],
      paginationInfo: { skip: 0, limit: 12, total: 1 },
    };
    searched.flush(response);
    all.flush(response);

    expect(result).toEqual({ items: [{ id: 'b1', ...book }], total: 1 });
  });

  it('leaves a library', () => {
    let done = false;
    service.leave('l1').subscribe(() => (done = true));

    const req = backend.expectOne(`${url}/l1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBe(true);
  });

  it('exports a library and names the file like the backend does', () => {
    let filename = '';
    const library = { id: 'l1', name: 'Novela negra!' } as SharedLibrary;
    service.export(library, 'csv').subscribe((file) => (filename = file.filename));

    const req = backend.expectOne((r) => r.url === `${url}/l1/download`);
    expect(req.request.params.get('format')).toBe('csv');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['a,b']));

    expect(filename).toBe('Novela_negra_.csv');
  });

  it('reports the errors of the backend', () => {
    let error: unknown;
    service.get('l1').subscribe({ error: (e) => (error = e) });

    backend
      .expectOne(`${url}/l1`)
      .flush(
        { statusCode: 404, errorCode: 'NOT FOUND ERROR', message: 'library not found' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(404);
  });
});
