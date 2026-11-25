import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { SharedBooksService } from './shared-books.service';

describe('SharedBooksService', () => {
  const url = `${environment.apiUrl}/shared-books`;
  let service: SharedBooksService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SharedBooksService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists the books as flat models, with the search only if there is one', () => {
    let result: unknown;
    service.list({ skip: 12, limit: 12, search: ' ros ' }).subscribe((page) => (result = page));
    service.list({ skip: 0, limit: 1, search: ' ' }).subscribe();

    const [searched, all] = backend.match((r) => r.url === url);
    expect(searched.request.params.toString()).toBe('skip=12&limit=12&search=ros');
    expect(all.request.params.toString()).toBe('skip=0&limit=1');
    searched.flush({
      results: [{ type: 'shared-books', id: 'b1', attributes: { bookTitle: 'Rossiya' } }],
      paginationInfo: { skip: 12, limit: 12, total: 13 },
    });

    expect(result).toEqual({ items: [{ id: 'b1', bookTitle: 'Rossiya' }], total: 13 });
  });

  it('gets a book', () => {
    let result: unknown;
    service.get('b1').subscribe((book) => (result = book));

    backend
      .expectOne(`${url}/b1`)
      .flush({ results: { type: 'shared-books', id: 'b1', attributes: { people: [] } } });

    expect(result).toEqual({ id: 'b1', people: [] });
  });

  it('reports the errors of the backend', () => {
    let error: unknown;
    service.get('b1').subscribe({ error: (e) => (error = e) });

    backend
      .expectOne(`${url}/b1`)
      .flush(
        { statusCode: 404, errorCode: 'NOT FOUND ERROR', message: 'shared book not found' },
        { status: 404, statusText: 'Not Found' },
      );

    expect((error as ApiError).statusCode).toBe(404);
  });
});
