import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { UserBooksService } from './user-books.service';

describe('UserBooksService', () => {
  let service: UserBooksService;
  let backend: HttpTestingController;

  const url = `${environment.apiUrl}/user-books`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UserBooksService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists the books of a library as flat models with pagination', () => {
    let result: unknown;
    service.listByLibrary('lib-1', { skip: 12, limit: 12 }).subscribe((page) => (result = page));

    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.params.get('libraryId')).toBe('lib-1');
    expect(req.request.params.get('skip')).toBe('12');
    expect(req.request.params.get('limit')).toBe('12');
    req.flush({
      results: [{ type: 'user-books', id: 'ub-1', attributes: { bookTitle: 'Rossiya' } }],
      paginationInfo: { skip: 12, limit: 12, total: 13 },
    });

    expect(result).toEqual({ items: [{ id: 'ub-1', bookTitle: 'Rossiya' }], total: 13 });
  });

  it('lists the books of the current user without narrowing to a library', () => {
    let result: unknown;
    service.list({ skip: 24, limit: 12 }).subscribe((page) => (result = page));

    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.params.has('libraryId')).toBe(false);
    expect(req.request.params.get('skip')).toBe('24');
    expect(req.request.params.get('limit')).toBe('12');
    req.flush({
      results: [{ type: 'user-books', id: 'ub-1', attributes: { bookTitle: 'Rossiya' } }],
      paginationInfo: { skip: 24, limit: 12, total: 25 },
    });

    expect(result).toEqual({ items: [{ id: 'ub-1', bookTitle: 'Rossiya' }], total: 25 });
  });

  it('sends the trimmed search, also within a library', () => {
    service.list({ skip: 0, limit: 12, search: '  rossiya ' }).subscribe();
    service.listByLibrary('lib-1', { skip: 0, limit: 12, search: 'shishin' }).subscribe();

    const [all, inLibrary] = backend.match((r) => r.url === url);
    expect(all.request.params.get('search')).toBe('rossiya');
    expect(inLibrary.request.params.get('search')).toBe('shishin');
    expect(inLibrary.request.params.get('libraryId')).toBe('lib-1');
    all.flush({ results: [], paginationInfo: { skip: 0, limit: 12, total: 0 } });
    inLibrary.flush({ results: [], paginationInfo: { skip: 0, limit: 12, total: 0 } });
  });

  it('leaves out an empty search', () => {
    service.list({ skip: 0, limit: 12, search: '   ' }).subscribe();

    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.params.has('search')).toBe(false);
    req.flush({ results: [], paginationInfo: { skip: 0, limit: 12, total: 0 } });
  });

  it('updates the rating and notes and returns the flat model', () => {
    let result: unknown;
    service.update('ub-1', { rating: 5, notes: null }).subscribe((book) => (result = book));

    const req = backend.expectOne(`${url}/ub-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ rating: 5, notes: null });
    req.flush({ results: { type: 'user-books', id: 'ub-1', attributes: { rating: 5 } } });

    expect(result).toEqual({ id: 'ub-1', rating: 5 });
  });

  it('turns HTTP errors into ApiError', () => {
    let error: unknown;
    service.listByLibrary('lib-1', { skip: 0, limit: 12 }).subscribe({ error: (e) => (error = e) });

    backend
      .expectOne((r) => r.url === url)
      .flush(
        { statusCode: 403, errorCode: 'PERMISSION ERROR', message: 'forbidden' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(403);
  });
});
