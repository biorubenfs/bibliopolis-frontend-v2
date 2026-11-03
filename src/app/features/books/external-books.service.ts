import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { ExternalBook } from './external-book.model';

@Injectable({ providedIn: 'root' })
export class ExternalBooksService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/external`;

  /** Finds a book by ISBN. Fails with a 400 for an invalid ISBN and a 404 if nobody knows it. */
  findByIsbn(isbn: string): Observable<ExternalBook> {
    const params = new HttpParams().set('isbn', isbn);
    return this.http.get<{ results: { attributes: ExternalBook } }>(this.baseUrl, { params }).pipe(
      map((response) => response.results.attributes),
      catchError((error: HttpErrorResponse) => throwError(() => ApiError.fromHttpError(error))),
    );
  }
}
