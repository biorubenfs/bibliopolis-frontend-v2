import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ApiCollectionResponse, ApiItemResponse, Page, flatten } from '../../core/http/api.models';
import { UpdateUserBook, UserBook } from './user-book.model';

type UserBookAttributes = Omit<UserBook, 'id'>;

interface ListOptions {
  skip: number;
  limit: number;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class UserBooksService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/user-books`;

  /**
   * Lists the books in any library of the current user. `search` matches part of the title, an
   * author or an ISBN (an exact ISBN, with or without hyphens); empty means no search.
   */
  list(options: ListOptions): Observable<Page<UserBook>> {
    return this.fetchPage(this.listParams(options));
  }

  /** Lists the books of a library, with the same `search` as `list()`. */
  listByLibrary(libraryId: string, options: ListOptions): Observable<Page<UserBook>> {
    return this.fetchPage(this.listParams(options).set('libraryId', libraryId));
  }

  /** Changes the rating and notes of a book; send null to clear them. */
  update(id: string, changes: UpdateUserBook): Observable<UserBook> {
    return this.http
      .patch<ApiItemResponse<UserBookAttributes>>(`${this.baseUrl}/${id}`, changes)
      .pipe(
        map((response) => flatten(response.results)),
        catchError((error: HttpErrorResponse) => throwError(() => ApiError.fromHttpError(error))),
      );
  }

  private listParams(options: ListOptions): HttpParams {
    let params = new HttpParams().set('skip', options.skip).set('limit', options.limit);
    const search = options.search?.trim();
    if (search) {
      params = params.set('search', search);
    }
    return params;
  }

  private fetchPage(params: HttpParams): Observable<Page<UserBook>> {
    return this.http.get<ApiCollectionResponse<UserBookAttributes>>(this.baseUrl, { params }).pipe(
      map((response) => ({
        items: response.results.map((item) => flatten(item)),
        total: response.paginationInfo.total,
      })),
      catchError((error: HttpErrorResponse) => throwError(() => ApiError.fromHttpError(error))),
    );
  }
}
