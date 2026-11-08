import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../core/http/api-error';
import {
  ApiCollectionResponse,
  ApiItemResponse,
  Page,
  flatten,
} from '../../../core/http/api.models';
import {
  CatalogBook,
  CoverCandidate,
  CreateCatalogBook,
  UpdateCatalogBook,
} from './catalog-book.model';

type BookAttributes = Omit<CatalogBook, 'id'>;

/** The catalog of books, as managed from the backoffice. */
@Injectable({ providedIn: 'root' })
export class CatalogBooksService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/books`;

  /** An ISBN finds that exact book; any other text is searched in the title and the authors. */
  list(options: { skip: number; limit: number; search?: string }): Observable<Page<CatalogBook>> {
    let params = new HttpParams().set('skip', options.skip).set('limit', options.limit);
    if (options.search) {
      params = params.set('search', options.search);
    }
    return this.http.get<ApiCollectionResponse<BookAttributes>>(this.baseUrl, { params }).pipe(
      map((response) => ({
        items: response.results.map(flatten),
        total: response.paginationInfo.total,
      })),
      catchError(toApiError),
    );
  }

  /** The catalog book with that ISBN, or null. */
  findByIsbn(isbn: string): Observable<CatalogBook | null> {
    return this.list({ skip: 0, limit: 1, search: isbn }).pipe(
      map((page) => page.items[0] ?? null),
    );
  }

  /** Fails with a 404 in the `sources` mode when no source has the book, and a 409 if it exists. */
  create(book: CreateCatalogBook): Observable<CatalogBook> {
    return this.http.post<ApiItemResponse<BookAttributes>>(this.baseUrl, book).pipe(
      map((response) => flatten(response.results)),
      catchError(toApiError),
    );
  }

  /** The backend also applies the changes to the books of the users who have it. */
  update(id: string, changes: UpdateCatalogBook): Observable<CatalogBook> {
    return this.http.patch<ApiItemResponse<BookAttributes>>(`${this.baseUrl}/${id}`, changes).pipe(
      map((response) => flatten(response.results)),
      catchError(toApiError),
    );
  }

  /** The cover that each source has for the book, in priority order. */
  listCovers(id: string): Observable<CoverCandidate[]> {
    return this.http
      .get<{ results: { attributes: { covers: CoverCandidate[] } } }>(
        `${this.baseUrl}/${id}/covers`,
      )
      .pipe(
        map((response) => response.results.attributes.covers),
        catchError(toApiError),
      );
  }
}

function toApiError(error: HttpErrorResponse): Observable<never> {
  return throwError(() => ApiError.fromHttpError(error));
}
