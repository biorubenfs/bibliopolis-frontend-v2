import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
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
});
