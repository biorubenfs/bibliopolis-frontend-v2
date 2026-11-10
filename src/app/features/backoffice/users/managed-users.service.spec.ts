import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../core/http/api-error';
import { ManagedUsersService } from './managed-users.service';

describe('ManagedUsersService', () => {
  let service: ManagedUsersService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ManagedUsersService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists the users with the search', () => {
    let total = 0;
    service.list({ skip: 12, limit: 12, search: 'ana' }).subscribe((page) => (total = page.total));

    const req = backend.expectOne((r) => r.url === `${environment.apiUrl}/users`);
    expect(req.request.params.get('search')).toBe('ana');
    expect(req.request.params.get('skip')).toBe('12');
    req.flush({ results: [], paginationInfo: { skip: 12, limit: 12, total: 13 } });

    expect(total).toBe(13);
  });

  it('returns the created user with the password from meta, without the avatar', () => {
    let result: unknown;
    service.create({ name: 'Ana', email: 'ana@email.com' }).subscribe((r) => (result = r));

    const req = backend.expectOne(`${environment.apiUrl}/users`);
    expect(req.request.body).toEqual({ name: 'Ana', email: 'ana@email.com' });
    req.flush({
      results: {
        type: 'users',
        id: 'u1',
        attributes: { name: 'Ana', email: 'ana@email.com', avatar: 'x' },
      },
      meta: { password: 'secret' },
    });

    expect(result).toEqual({
      user: { id: 'u1', name: 'Ana', email: 'ana@email.com' },
      password: 'secret',
    });
  });

  it('resets the password of a user', () => {
    let password = '';
    service.resetPassword('u1').subscribe((r) => (password = r.password));

    const req = backend.expectOne(`${environment.apiUrl}/users/u1/password-reset`);
    expect(req.request.method).toBe('POST');
    req.flush({ results: { type: 'users', id: 'u1', attributes: {} }, meta: { password: 'new' } });

    expect(password).toBe('new');
  });

  it('gets a user, flattened', () => {
    let user: unknown;
    service.get('u1').subscribe((u) => (user = u));

    backend
      .expectOne(`${environment.apiUrl}/users/u1`)
      .flush({ results: { type: 'users', id: 'u1', attributes: { name: 'Ana' } } });

    expect(user).toEqual({ id: 'u1', name: 'Ana' });
  });

  it('gets the stats of a user without the envelope', () => {
    let stats: unknown;
    service.getStats('u1').subscribe((s) => (stats = s));

    const attributes = { libraries: { count: 1 } };
    backend
      .expectOne(`${environment.apiUrl}/users/u1/stats`)
      .flush({ results: { type: 'user-stats', attributes } });

    expect(stats).toEqual(attributes);
  });

  it('turns a 404 of the stats into an ApiError', () => {
    let status = 0;
    service.getStats('admin').subscribe({ error: (e: ApiError) => (status = e.statusCode) });

    backend
      .expectOne(`${environment.apiUrl}/users/admin/stats`)
      .flush(
        { statusCode: 404, errorCode: 'NOT FOUND ERROR', message: 'user not found' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(status).toBe(404);
  });
});
