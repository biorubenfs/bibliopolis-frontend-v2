import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { SharedLibrariesService } from './shared-libraries.service';

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
