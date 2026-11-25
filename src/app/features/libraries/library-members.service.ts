import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ApiCollectionResponse, ApiItemResponse, Page, flatten } from '../../core/http/api.models';
import { LibraryMember } from './library-member.model';

type LibraryMemberAttributes = Omit<LibraryMember, 'id'>;

/** The people a library of the user is shared with. */
@Injectable({ providedIn: 'root' })
export class LibraryMembersService {
  private readonly http = inject(HttpClient);

  /** Lists the members, the most recent first. */
  list(
    libraryId: string,
    options: { skip: number; limit: number },
  ): Observable<Page<LibraryMember>> {
    const params = new HttpParams().set('skip', options.skip).set('limit', options.limit);
    return this.http
      .get<ApiCollectionResponse<LibraryMemberAttributes>>(this.url(libraryId), { params })
      .pipe(
        map((response) => ({
          items: response.results.map((item) => flatten(item)),
          total: response.paginationInfo.total,
        })),
        catchError(toApiError),
      );
  }

  /** Gives read-only access to the user with that exact email. */
  invite(libraryId: string, email: string): Observable<LibraryMember> {
    return this.http
      .post<ApiItemResponse<LibraryMemberAttributes>>(this.url(libraryId), { email })
      .pipe(
        map((response) => flatten(response.results)),
        catchError(toApiError),
      );
  }

  remove(libraryId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.url(libraryId)}/${userId}`).pipe(catchError(toApiError));
  }

  private url(libraryId: string): string {
    return `${environment.apiUrl}/libraries/${libraryId}/members`;
  }
}

function toApiError(error: HttpErrorResponse): Observable<never> {
  return throwError(() => ApiError.fromHttpError(error));
}
