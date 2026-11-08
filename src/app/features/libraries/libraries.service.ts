import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ApiCollectionResponse, ApiItemResponse, Page, flatten } from '../../core/http/api.models';
import {
  AddBookToLibrary,
  CreateLibrary,
  Library,
  LibraryExportFormat,
  UpdateLibrary,
} from './library.model';

type LibraryAttributes = Omit<Library, 'id'>;

@Injectable({ providedIn: 'root' })
export class LibrariesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/libraries`;

  /**
   * Lists the user's libraries, favorites first. `search` filters by name or description (partial,
   * case-insensitive), `favorites` keeps only the favorites and `tagIds` the libraries that have
   * all of those tags.
   */
  list(options: {
    skip: number;
    limit: number;
    search?: string;
    favorites?: boolean;
    tagIds?: readonly string[];
  }): Observable<Page<Library>> {
    let params = new HttpParams().set('skip', options.skip).set('limit', options.limit);
    const search = options.search?.trim();
    if (search) {
      params = params.set('search', search);
    }
    // The API only accepts "true": without the filter the param is left out
    if (options.favorites) {
      params = params.set('favorites', 'true');
    }
    if (options.tagIds?.length) {
      params = params.set('tags', options.tagIds.join(','));
    }
    return this.http.get<ApiCollectionResponse<LibraryAttributes>>(this.baseUrl, { params }).pipe(
      map((response) => ({
        items: response.results.map((item) => flatten(item)),
        total: response.paginationInfo.total,
      })),
      catchError(toApiError),
    );
  }

  get(id: string): Observable<Library> {
    return this.http.get<ApiItemResponse<LibraryAttributes>>(`${this.baseUrl}/${id}`).pipe(
      map((response) => flatten(response.results)),
      catchError(toApiError),
    );
  }

  create(library: CreateLibrary): Observable<Library> {
    return this.http.post<ApiItemResponse<LibraryAttributes>>(this.baseUrl, library).pipe(
      map((response) => flatten(response.results)),
      catchError(toApiError),
    );
  }

  update(id: string, changes: UpdateLibrary): Observable<Library> {
    return this.http
      .patch<ApiItemResponse<LibraryAttributes>>(`${this.baseUrl}/${id}`, changes)
      .pipe(
        map((response) => flatten(response.results)),
        catchError(toApiError),
      );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(catchError(toApiError));
  }

  /** Adds a book to a library; fails with a 409 if the library already contains it. */
  addBook(libraryId: string, book: AddBookToLibrary): Observable<Library> {
    return this.http
      .post<ApiItemResponse<LibraryAttributes>>(`${this.baseUrl}/${libraryId}/books`, book)
      .pipe(
        map((response) => flatten(response.results)),
        catchError(toApiError),
      );
  }

  /** Removes a book from a library. The user keeps the book, its rating and its notes. */
  removeBook(libraryId: string, userBookId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${libraryId}/books/${userBookId}`)
      .pipe(catchError(toApiError));
  }

  /** Exports the books of a library as a PDF or CSV file. */
  export(
    library: Library,
    format: LibraryExportFormat,
  ): Observable<{ blob: Blob; filename: string }> {
    const params = new HttpParams().set('libraryId', library.id).set('format', format);
    return this.http
      .get(`${environment.apiUrl}/user-books/download`, { params, responseType: 'blob' })
      .pipe(
        // Content-Disposition is not exposed through CORS, so the backend's naming rule is mirrored here
        map((blob) => ({
          blob,
          filename: `${library.name.replace(/[^a-z0-9_-]/gi, '_')}.${format}`,
        })),
        catchError(toApiError),
      );
  }
}

function toApiError(error: HttpErrorResponse): Observable<never> {
  return throwError(() => ApiError.fromHttpError(error));
}
