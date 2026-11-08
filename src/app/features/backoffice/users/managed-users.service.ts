import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../core/http/api-error';
import { ApiCollectionResponse, ApiResource, Page, flatten } from '../../../core/http/api.models';
import { User } from '../../../core/users/user.model';

/** The user list leaves out the avatar. */
export type ManagedUser = Omit<User, 'avatar'>;

export interface NewUser {
  name: string;
  email: string;
}

/** A user together with the password the backend has just generated. It cannot be read again. */
export interface UserWithPassword {
  user: ManagedUser;
  password: string;
}

interface UserWithPasswordResponse {
  results: ApiResource<Omit<User, 'id'>>;
  meta: { password: string };
}

/** The users, as managed from the backoffice. */
@Injectable({ providedIn: 'root' })
export class ManagedUsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  /** Newest first. The search looks in the name and the email. */
  list(options: { skip: number; limit: number; search?: string }): Observable<Page<ManagedUser>> {
    let params = new HttpParams().set('skip', options.skip).set('limit', options.limit);
    if (options.search) {
      params = params.set('search', options.search);
    }
    return this.http
      .get<ApiCollectionResponse<Omit<ManagedUser, 'id'>>>(this.baseUrl, { params })
      .pipe(
        map((response) => ({
          items: response.results.map(flatten),
          total: response.paginationInfo.total,
        })),
        catchError(toApiError),
      );
  }

  /** Creates a regular user. Fails with a 409 if the email is already registered. */
  create(user: NewUser): Observable<UserWithPassword> {
    return this.http
      .post<UserWithPasswordResponse>(this.baseUrl, user)
      .pipe(map(toUserWithPassword), catchError(toApiError));
  }

  /** Only for regular users. */
  resetPassword(userId: string): Observable<UserWithPassword> {
    return this.http
      .post<UserWithPasswordResponse>(`${this.baseUrl}/${userId}/password-reset`, {})
      .pipe(map(toUserWithPassword), catchError(toApiError));
  }
}

function toUserWithPassword(response: UserWithPasswordResponse): UserWithPassword {
  const { avatar: _avatar, ...user } = flatten(response.results);
  return { user, password: response.meta.password };
}

function toApiError(error: HttpErrorResponse): Observable<never> {
  return throwError(() => ApiError.fromHttpError(error));
}
