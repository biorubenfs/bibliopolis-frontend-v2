import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ApiCollectionResponse, ApiItemResponse, Page, flatten } from '../../core/http/api.models';
import { UpdateUserBook, UserBook } from './user-book.model';

type UserBookAttributes = Omit<UserBook, 'id'>;

@Injectable({ providedIn: 'root' })
export class UserBooksService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/user-books`;

  /** Lists the books of a library. */
  listByLibrary(
    libraryId: string,
    options: { skip: number; limit: number },
  ): Observable<Page<UserBook>> {
    const params = new HttpParams()
      .set('libraryId', libraryId)
      .set('skip', options.skip)
      .set('limit', options.limit);
    return this.http.get<ApiCollectionResponse<UserBookAttributes>>(this.baseUrl, { params }).pipe(
      map((response) => ({
        items: response.results.map((item) => flatten(item)),
        total: response.paginationInfo.total,
      })),
      catchError((error: HttpErrorResponse) => throwError(() => ApiError.fromHttpError(error))),
    );
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
}
