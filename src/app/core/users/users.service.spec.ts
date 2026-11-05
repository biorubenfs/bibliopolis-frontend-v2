import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiError } from '../http/api-error';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UsersService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('updates the name and returns the user as a flat model', () => {
    let result: unknown;
    service.updateName('Ana').subscribe((user) => (result = user));

    const req = backend.expectOne(`${environment.apiUrl}/users/me`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Ana' });
    req.flush({ results: { type: 'users', id: 'u1', attributes: { name: 'Ana', avatar: 'abc' } } });

    expect(result).toEqual({ id: 'u1', name: 'Ana', avatar: 'abc' });
  });

  it('updates the password', () => {
    const passwords = { currentPassword: 'old-secret', newPassword: 'new-secret' };
    let done = false;
    service.updatePassword(passwords).subscribe(() => (done = true));

    const req = backend.expectOne(`${environment.apiUrl}/users/me/password`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(passwords);
    req.flush({ results: { type: 'users', id: 'u1', attributes: {} } });

    expect(done).toBe(true);
  });

  it('maps backend errors to ApiError', () => {
    let error: unknown;
    service
      .updatePassword({ currentPassword: 'wrong', newPassword: 'new-secret' })
      .subscribe({ error: (e) => (error = e) });

    backend
      .expectOne(`${environment.apiUrl}/users/me/password`)
      .flush(
        { statusCode: 400, errorCode: 'INVALID PASSWORD', message: 'invalid current password' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).errorCode).toBe('INVALID PASSWORD');
  });
});
