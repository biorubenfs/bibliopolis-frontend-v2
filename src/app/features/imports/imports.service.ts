import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, expand, map, reduce, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ApiCollectionResponse, ApiItemResponse, Page, flatten } from '../../core/http/api.models';
import {
  ImportAnalysis,
  ImportItem,
  ImportItemOutcome,
  ImportItemResolution,
  ImportRequest,
  LibraryImport,
} from './import.model';

type ImportAttributes = Omit<LibraryImport, 'id'>;
type ImportItemAttributes = Omit<ImportItem, 'id'>;

/** The largest page the backend accepts. */
const MAX_PAGE_SIZE = 100;

@Injectable({ providedIn: 'root' })
export class ImportsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/imports`;

  /** Reads and validates the file on the backend without creating anything. */
  analyze(request: ImportRequest): Observable<ImportAnalysis> {
    return this.http
      .post<{ results: { attributes: ImportAnalysis } }>(this.baseUrl, toFormData(request), {
        params: new HttpParams().set('dryRun', true),
      })
      .pipe(
        map((response) => response.results.attributes),
        catchError(toApiError),
      );
  }

  /** Creates the import, which goes on in the background: follow it with `get`. */
  create(request: ImportRequest): Observable<LibraryImport> {
    return this.http
      .post<ApiItemResponse<ImportAttributes>>(this.baseUrl, toFormData(request))
      .pipe(
        map((response) => flatten(response.results)),
        catchError(toApiError),
      );
  }

  /** Lists the imports of a library, the newest first. */
  listByLibrary(
    libraryId: string,
    options: { skip: number; limit: number },
  ): Observable<Page<LibraryImport>> {
    const params = new HttpParams()
      .set('libraryId', libraryId)
      .set('skip', options.skip)
      .set('limit', options.limit);
    return this.http.get<ApiCollectionResponse<ImportAttributes>>(this.baseUrl, { params }).pipe(
      map((response) => ({
        items: response.results.map((item) => flatten(item)),
        total: response.paginationInfo.total,
      })),
      catchError(toApiError),
    );
  }

  get(id: string): Observable<LibraryImport> {
    return this.http.get<ApiItemResponse<ImportAttributes>>(`${this.baseUrl}/${id}`).pipe(
      map((response) => flatten(response.results)),
      catchError(toApiError),
    );
  }

  /**
   * Lists the rows of an import in file order; `pending` leaves only those that need action, and
   * `outcome` only those with that result.
   */
  listItems(
    id: string,
    options: { skip: number; limit: number; pending?: boolean; outcome?: ImportItemOutcome },
  ): Observable<Page<ImportItem>> {
    let params = new HttpParams().set('skip', options.skip).set('limit', options.limit);
    if (options.pending !== undefined) {
      params = params.set('pending', options.pending);
    }
    if (options.outcome !== undefined) {
      params = params.set('outcome', options.outcome);
    }
    return this.http
      .get<ApiCollectionResponse<ImportItemAttributes>>(`${this.baseUrl}/${id}/items`, { params })
      .pipe(
        map((response) => ({
          items: response.results.map((item) => flatten(item)),
          total: response.paginationInfo.total,
        })),
        catchError(toApiError),
      );
  }

  /** All the pending rows, however many pages they take. */
  listAllPending(id: string): Observable<ImportItem[]> {
    const fetchPage = (skip: number) =>
      this.listItems(id, { skip, limit: MAX_PAGE_SIZE, pending: true }).pipe(
        map((page) => ({ ...page, nextSkip: skip + page.items.length })),
      );

    return fetchPage(0).pipe(
      expand((page) =>
        page.items.length > 0 && page.nextSkip < page.total ? fetchPage(page.nextSkip) : EMPTY,
      ),
      reduce((items: ImportItem[], page) => [...items, ...page.items], []),
    );
  }

  /** Marks a row as dismissed or added by hand; `null` undoes it. */
  updateItem(
    id: string,
    itemId: string,
    resolution: ImportItemResolution | null,
  ): Observable<ImportItem> {
    return this.http
      .patch<ApiItemResponse<ImportItemAttributes>>(`${this.baseUrl}/${id}/items/${itemId}`, {
        resolution,
      })
      .pipe(
        map((response) => flatten(response.results)),
        catchError(toApiError),
      );
  }

  /** Queues again the rows that failed because of a technical error. */
  retry(id: string): Observable<LibraryImport> {
    return this.http
      .post<ApiItemResponse<ImportAttributes>>(`${this.baseUrl}/${id}/retry`, null)
      .pipe(
        map((response) => flatten(response.results)),
        catchError(toApiError),
      );
  }
}

function toFormData({ file, libraryId, isbnColumns }: ImportRequest): FormData {
  const form = new FormData();
  form.append('libraryId', libraryId);
  isbnColumns?.forEach((column) => form.append('isbnColumns', String(column)));
  form.append('file', file, file.name);
  return form;
}

function toApiError(error: HttpErrorResponse): Observable<never> {
  return throwError(() => ApiError.fromHttpError(error));
}
