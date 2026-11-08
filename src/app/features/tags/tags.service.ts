import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ApiCollectionResponse, ApiItemResponse, flatten } from '../../core/http/api.models';
import { CreateTag, Tag, UpdateTag, sortTags } from './tag.model';

type TagAttributes = Omit<Tag, 'id'>;

/** The maximum page size of the API; enough for 10 personal tags plus the global ones. */
const ALL_TAGS_LIMIT = 100;

@Injectable({ providedIn: 'root' })
export class TagsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/tags`;

  /** All the tags the user can use, own and global, sorted by name. */
  listAll(): Observable<Tag[]> {
    const params = new HttpParams().set('skip', 0).set('limit', ALL_TAGS_LIMIT);
    return this.http.get<ApiCollectionResponse<TagAttributes>>(this.baseUrl, { params }).pipe(
      map((response) => sortTags(response.results.map((item) => flatten(item)))),
      catchError(toApiError),
    );
  }

  create(tag: CreateTag): Observable<Tag> {
    return this.http.post<ApiItemResponse<TagAttributes>>(this.baseUrl, tag).pipe(
      map((response) => flatten(response.results)),
      catchError(toApiError),
    );
  }

  update(id: string, changes: UpdateTag): Observable<Tag> {
    return this.http.patch<ApiItemResponse<TagAttributes>>(`${this.baseUrl}/${id}`, changes).pipe(
      map((response) => flatten(response.results)),
      catchError(toApiError),
    );
  }

  /** Deletes a tag; the backend also removes it from the user's libraries. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(catchError(toApiError));
  }
}

function toApiError(error: HttpErrorResponse): Observable<never> {
  return throwError(() => ApiError.fromHttpError(error));
}

/** User-facing message for a failed create or rename. */
export function tagErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.errorCode === 'TAG LIMIT REACHED') {
    return 'Has llegado al máximo de etiquetas. Borra alguna para crear otra.';
  }
  if (error instanceof ApiError && error.statusCode === 409) {
    return 'Ya existe una etiqueta con ese nombre.';
  }
  return 'No se ha podido guardar la etiqueta. Inténtalo de nuevo.';
}
