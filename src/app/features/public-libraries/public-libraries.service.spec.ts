import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { PublicLibrariesService } from './public-libraries.service';

describe('PublicLibrariesService', () => {
  const url = `${environment.apiUrl}/public-libraries`;
  const library = { name: 'Novela', ownerName: 'Ana', booksCount: 2, publishedAt: '2026-11-27' };
  let service: PublicLibrariesService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PublicLibrariesService);
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
      results: [{ type: 'public-libraries', id: 'l1', attributes: library }],
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
    searched.flush({ results: [], paginationInfo: { skip: 0, limit: 12, total: 0 } });
    all.flush({ results: [], paginationInfo: { skip: 0, limit: 12, total: 0 } });
  });

  it('fails with an ApiError', () => {
    let error: unknown;
    service.list({ skip: 0, limit: 12 }).subscribe({ error: (e: unknown) => (error = e) });

    backend
      .expectOne((r) => r.url === url)
      .flush(
        { statusCode: 400, errorCode: 'VALIDATION ERROR', message: 'invalid query' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('invalid query');
  });
});
