import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  const logout = vi.fn();
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    logout.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { accessToken: () => 'token-123', logout } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('adds the bearer token to backend requests', () => {
    http.get(`${environment.apiUrl}/libraries`).subscribe();
    const req = backend.expectOne(`${environment.apiUrl}/libraries`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush({});
  });

  it('does not add the token to the login request', () => {
    http.post(`${environment.apiUrl}/auth/login`, {}).subscribe();
    const req = backend.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('clears the session and goes to the login page on 401', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http.get(`${environment.apiUrl}/auth/me`).subscribe({ error: () => undefined });

    backend
      .expectOne(`${environment.apiUrl}/auth/me`)
      .flush({ message: 'token expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
