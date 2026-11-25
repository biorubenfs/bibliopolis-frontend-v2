import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ApiCollectionResponse, ApiItemResponse, Page, flatten } from '../../core/http/api.models';
import { SharedBook, SharedBookDetail } from './shared-book.model';

/** The books of all the libraries that other users share with the current one. */
@Injectable({ providedIn: 'root' })
export class SharedBooksService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/shared-books`;

  /** `search` matches part of the title, an author or an ISBN; empty means no search. */
  list(options: { skip: number; limit: number; search?: string }): Observable<Page<SharedBook>> {
    let params = new HttpParams().set('skip', options.skip).set('limit', options.limit);
    const search = options.search?.trim();
    if (search) {
      params = params.set('search', search);
    }
    return this.http
      .get<ApiCollectionResponse<Omit<SharedBook, 'id'>>>(this.baseUrl, { params })
      .pipe(
        map((response) => ({
          items: response.results.map((item) => flatten(item)),
          total: response.paginationInfo.total,
        })),
        catchError(toApiError),
      );
  }

  /** Fails with a 404 if nobody shares the book any more. */
  get(id: string): Observable<SharedBookDetail> {
    return this.http
      .get<ApiItemResponse<Omit<SharedBookDetail, 'id'>>>(`${this.baseUrl}/${id}`)
      .pipe(
        map((response) => flatten(response.results)),
        catchError(toApiError),
      );
  }
}

function toApiError(error: HttpErrorResponse): Observable<never> {
  return throwError(() => ApiError.fromHttpError(error));
}
