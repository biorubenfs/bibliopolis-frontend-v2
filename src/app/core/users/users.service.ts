import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../http/api-error';
import { ApiItemResponse, flatten } from '../http/api.models';
import { User } from './user.model';

export interface UpdatePassword {
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly meUrl = `${environment.apiUrl}/users/me`;

  /** Renames the authenticated user; the backend also regenerates the avatar from the new name. */
  updateName(name: string): Observable<User> {
    return this.http.patch<ApiItemResponse<Omit<User, 'id'>>>(this.meUrl, { name }).pipe(
      map((response) => flatten(response.results)),
      catchError((error: HttpErrorResponse) => throwError(() => ApiError.fromHttpError(error))),
    );
  }

  updatePassword(passwords: UpdatePassword): Observable<void> {
    return this.http.patch<unknown>(`${this.meUrl}/password`, passwords).pipe(
      map(() => undefined),
      catchError((error: HttpErrorResponse) => throwError(() => ApiError.fromHttpError(error))),
    );
  }
}
