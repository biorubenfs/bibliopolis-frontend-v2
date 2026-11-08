import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiError } from '../http/api-error';
import { AuthService } from './auth.service';

function fakeToken(exp: number, role?: string): string {
  return `header.${btoa(JSON.stringify({ exp, role }))}.signature`;
}

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('stores the token after a successful login', () => {
    const token = fakeToken(Date.now() / 1000 + 3600);
    service.login({ email: 'a@b.com', password: 'secret' }).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.com', password: 'secret' });
    req.flush({ results: { type: 'auth', attributes: { accessToken: token } } });

    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('bibliopolis.accessToken')).toBe(token);
  });

  it('maps backend errors to ApiError', () => {
    let error: unknown;
    service.login({ email: 'a@b.com', password: 'wrong' }).subscribe({ error: (e) => (error = e) });

    http
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush(
        {
          statusCode: 403,
          errorCode: 'INVALID CREDENTIALS ERROR',
          message: 'invalid email or password',
        },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(403);
    expect((error as ApiError).errorCode).toBe('INVALID CREDENTIALS ERROR');
    expect(service.isAuthenticated()).toBe(false);
  });

  it('removes the token on logout', () => {
    service.login({ email: 'a@b.com', password: 'secret' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({
      results: { type: 'auth', attributes: { accessToken: fakeToken(Date.now() / 1000 + 3600) } },
    });

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('bibliopolis.accessToken')).toBeNull();
  });

  it('reads the role from the token and chooses the home page', () => {
    service.login({ email: 'a@b.com', password: 'secret' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({
      results: {
        type: 'auth',
        attributes: { accessToken: fakeToken(Date.now() / 1000 + 3600, 'admin') },
      },
    });

    expect(service.role()).toBe('admin');
    expect(service.homeUrl()).toBe('/backoffice');

    service.logout();
    expect(service.role()).toBeNull();
    expect(service.homeUrl()).toBe('/libraries');
  });

  it('treats a token without a known role as a regular user', () => {
    service.login({ email: 'a@b.com', password: 'secret' }).subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush({
      results: { type: 'auth', attributes: { accessToken: fakeToken(Date.now() / 1000 + 3600) } },
    });

    expect(service.role()).toBe('regular');
    expect(service.homeUrl()).toBe('/libraries');
  });
});
