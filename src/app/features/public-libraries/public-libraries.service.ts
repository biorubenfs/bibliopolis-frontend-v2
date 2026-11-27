import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ApiCollectionResponse, Page, flatten } from '../../core/http/api.models';
import { PublicLibrary } from './public-library.model';

/** The public libraries of other users. Each one is read with `SharedLibrariesService`. */
@Injectable({ providedIn: 'root' })
export class PublicLibrariesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/public-libraries`;

  /**
   * Lists the libraries, the most recently published first, without the own ones. `search` matches
   * part of the name, the description or the name of the owner; empty means no search.
   */
  list(options: { skip: number; limit: number; search?: string }): Observable<Page<PublicLibrary>> {
    let params = new HttpParams().set('skip', options.skip).set('limit', options.limit);
    const search = options.search?.trim();
    if (search) {
      params = params.set('search', search);
    }
    return this.http
      .get<ApiCollectionResponse<Omit<PublicLibrary, 'id'>>>(this.baseUrl, { params })
      .pipe(
        map((response) => ({
          items: response.results.map((item) => flatten(item)),
          total: response.paginationInfo.total,
        })),
        catchError((error: HttpErrorResponse) => throwError(() => ApiError.fromHttpError(error))),
      );
  }
}
