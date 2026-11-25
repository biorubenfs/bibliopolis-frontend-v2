import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ApiCollectionResponse, ApiItemResponse, Page, flatten } from '../../core/http/api.models';
import { SharedLibrary, SharedLibraryBook } from './shared-library.model';

type SharedLibraryAttributes = Omit<SharedLibrary, 'id'>;
type SharedLibraryBookAttributes = Omit<SharedLibraryBook, 'id'>;

/** The libraries that other users share with the current one. */
@Injectable({ providedIn: 'root' })
export class SharedLibrariesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/shared-libraries`;

  /** Lists the libraries, the most recently shared first. */
  list(options: { skip: number; limit: number }): Observable<Page<SharedLibrary>> {
    const params = new HttpParams().set('skip', options.skip).set('limit', options.limit);
    return this.http
      .get<ApiCollectionResponse<SharedLibraryAttributes>>(this.baseUrl, { params })
      .pipe(map(toPage), catchError(toApiError));
  }

  /** Fails with a 404 without access, as if the library did not exist. */
  get(id: string): Observable<SharedLibrary> {
    return this.http.get<ApiItemResponse<SharedLibraryAttributes>>(`${this.baseUrl}/${id}`).pipe(
      map((response) => flatten(response.results)),
      catchError(toApiError),
    );
  }

  /** `search` matches part of the title, an author or an ISBN; empty means no search. */
  listBooks(
    id: string,
    options: { skip: number; limit: number; search?: string },
  ): Observable<Page<SharedLibraryBook>> {
    let params = new HttpParams().set('skip', options.skip).set('limit', options.limit);
    const search = options.search?.trim();
    if (search) {
      params = params.set('search', search);
    }
    return this.http
      .get<ApiCollectionResponse<SharedLibraryBookAttributes>>(`${this.baseUrl}/${id}/books`, {
        params,
      })
      .pipe(map(toPage), catchError(toApiError));
  }

  /** The user gives up their access; only the owner can give it back. */
  leave(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(catchError(toApiError));
  }
}

function toPage<T>(response: ApiCollectionResponse<T>): Page<T & { id: string }> {
  return {
    items: response.results.map((item) => flatten(item)),
    total: response.paginationInfo.total,
  };
}

function toApiError(error: HttpErrorResponse): Observable<never> {
  return throwError(() => ApiError.fromHttpError(error));
}
