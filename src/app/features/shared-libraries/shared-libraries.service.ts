import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ApiCollectionResponse, ApiItemResponse, Page, flatten } from '../../core/http/api.models';
import { LibraryExportFormat, libraryExportFilename } from '../libraries/library.model';
import { SharedLibrary, SharedLibraryBook, SharedLibraryOwner } from './shared-library.model';

/** The maximum page size of the API: more people would not fit in a menu anyway. */
const MAX_OWNERS = 100;

type SharedLibraryAttributes = Omit<SharedLibrary, 'id'>;
type SharedLibraryBookAttributes = Omit<SharedLibraryBook, 'id'>;

/** The libraries that other users share with the current one. */
@Injectable({ providedIn: 'root' })
export class SharedLibrariesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/shared-libraries`;

  /**
   * Lists the libraries, the most recently shared first. `search` matches part of the name, the
   * description or the name of the owner, and `ownerId` keeps only the ones of that owner; empty
   * means no search nor filter.
   */
  list(options: {
    skip: number;
    limit: number;
    search?: string;
    ownerId?: string;
  }): Observable<Page<SharedLibrary>> {
    let params = new HttpParams().set('skip', options.skip).set('limit', options.limit);
    const search = options.search?.trim();
    if (search) {
      params = params.set('search', search);
    }
    if (options.ownerId) {
      params = params.set('owner', options.ownerId);
    }
    return this.http
      .get<ApiCollectionResponse<SharedLibraryAttributes>>(this.baseUrl, { params })
      .pipe(map(toPage), catchError(toApiError));
  }

  /** Who shares libraries with the user, by name. */
  listOwners(): Observable<SharedLibraryOwner[]> {
    const params = new HttpParams().set('skip', 0).set('limit', MAX_OWNERS);
    return this.http
      .get<ApiCollectionResponse<Omit<SharedLibraryOwner, 'id'>>>(`${this.baseUrl}/owners`, {
        params,
      })
      .pipe(
        map((response) => toPage(response).items),
        catchError(toApiError),
      );
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

  /** Exports the books of the library as a PDF or CSV file, the same files its owner gets. */
  export(
    library: Pick<SharedLibrary, 'id' | 'name'>,
    format: LibraryExportFormat,
  ): Observable<{ blob: Blob; filename: string }> {
    const params = new HttpParams().set('format', format);
    return this.http
      .get(`${this.baseUrl}/${library.id}/download`, { params, responseType: 'blob' })
      .pipe(
        map((blob) => ({ blob, filename: libraryExportFilename(library.name, format) })),
        catchError(toApiError),
      );
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
