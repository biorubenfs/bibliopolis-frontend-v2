import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, tap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiError } from '../http/api-error';
import { ApiItemResponse, flatten } from '../http/api.models';
import { User, UserRole } from '../users/user.model';
import { LoginCredentials, LoginResponse } from './auth.models';

const TOKEN_STORAGE_KEY = 'bibliopolis.accessToken';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly token = signal<string | null>(readStoredToken());
  private readonly user = signal<User | null>(null);

  readonly accessToken = this.token.asReadonly();
  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => {
    const token = this.token();
    return token !== null && !isTokenExpired(token);
  });
  /** Read from the token, so it is known before the user is loaded (e.g. in the route guards). */
  readonly role = computed<UserRole | null>(() => {
    const token = this.token();
    return token === null ? null : readRole(token);
  });
  /** Admins work in the backoffice; regular users, with their libraries. */
  readonly homeUrl = computed(() => (this.role() === 'admin' ? '/backoffice' : '/libraries'));

  login(credentials: LoginCredentials): Observable<void> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
      tap((response) => this.setToken(response.results.attributes.accessToken)),
      map(() => undefined),
      catchError((error: HttpErrorResponse) => throwError(() => ApiError.fromHttpError(error))),
    );
  }

  /** Loads the authenticated user (name, avatar…) from the backend. */
  loadCurrentUser(): Observable<User> {
    return this.http.get<ApiItemResponse<Omit<User, 'id'>>>(`${environment.apiUrl}/auth/me`).pipe(
      map((response) => flatten(response.results)),
      tap((user) => this.user.set(user)),
      catchError((error: HttpErrorResponse) => throwError(() => ApiError.fromHttpError(error))),
    );
  }

  /** Replaces the user kept in memory, e.g. after a profile update returned the fresh data. */
  setCurrentUser(user: User): void {
    this.user.set(user);
  }

  /** The backend is stateless (single JWT), so logging out only discards the local session. */
  logout(): void {
    this.setToken(null);
    this.user.set(null);
  }

  private setToken(token: string | null): void {
    this.token.set(token);
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // Storage unavailable (e.g. private mode): keep the token in memory only
    }
  }
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    const parsed: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = readPayload(token);
  // Malformed token: treat it as expired
  if (payload === null) return true;
  return typeof payload['exp'] === 'number' && payload['exp'] * 1000 <= Date.now();
}

/** The backend checks the role on every request: this only decides which screens to show. */
function readRole(token: string): UserRole {
  return readPayload(token)?.['role'] === 'admin' ? 'admin' : 'regular';
}
