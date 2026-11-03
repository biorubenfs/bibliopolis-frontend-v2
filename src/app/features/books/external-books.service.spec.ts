import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ExternalBooksService } from './external-books.service';

describe('ExternalBooksService', () => {
  let service: ExternalBooksService;
  let backend: HttpTestingController;

  const url = `${environment.apiUrl}/external`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExternalBooksService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('finds a book by ISBN', () => {
    let result: unknown;
    service.findByIsbn('9780595385294').subscribe((book) => (result = book));

    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.params.get('isbn')).toBe('9780595385294');
    req.flush({ results: { type: 'book-result', attributes: { title: 'Rossiya' } } });

    expect(result).toEqual({ title: 'Rossiya' });
  });

  it('turns HTTP errors into ApiError', () => {
    let error: unknown;
    service.findByIsbn('9780595385294').subscribe({ error: (e) => (error = e) });

    backend
      .expectOne((r) => r.url === url)
      .flush(
        { statusCode: 404, errorCode: 'BOOKS API ERROR', message: 'Book not found in any source' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(404);
  });
});
