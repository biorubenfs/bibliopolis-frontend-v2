import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ApiError } from '../../core/http/api-error';
import { inviteErrorMessage } from './library-member.model';
import { LibraryMembersService } from './library-members.service';

describe('LibraryMembersService', () => {
  const url = `${environment.apiUrl}/libraries/lib-1/members`;
  const attributes = { userId: 'u2', name: 'Ana', email: 'ana@email.com', createdAt: '2026' };
  let service: LibraryMembersService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LibraryMembersService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists the members as flat models with pagination', () => {
    let result: unknown;
    service.list('lib-1', { skip: 0, limit: 1 }).subscribe((page) => (result = page));

    const req = backend.expectOne((r) => r.url === url);
    expect(req.request.params.get('skip')).toBe('0');
    expect(req.request.params.get('limit')).toBe('1');
    req.flush({
      results: [{ type: 'library-members', id: 'u2', attributes }],
      paginationInfo: { skip: 0, limit: 1, total: 3 },
    });

    expect(result).toEqual({ items: [{ id: 'u2', ...attributes }], total: 3 });
  });

  it('invites by email', () => {
    let result: unknown;
    service.invite('lib-1', 'ana@email.com').subscribe((member) => (result = member));

    const req = backend.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'ana@email.com' });
    req.flush({ results: { type: 'library-members', id: 'u2', attributes } });

    expect(result).toEqual({ id: 'u2', ...attributes });
  });

  it('removes a member', () => {
    let done = false;
    service.remove('lib-1', 'u2').subscribe(() => (done = true));

    const req = backend.expectOne(`${url}/u2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBe(true);
  });

  it('reports the errors of the backend', () => {
    let error: unknown;
    service.invite('lib-1', 'nobody@email.com').subscribe({ error: (e) => (error = e) });

    backend
      .expectOne(url)
      .flush(
        { statusCode: 404, errorCode: 'NOT FOUND ERROR', message: 'user not found' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('user not found');
  });
});

describe('inviteErrorMessage', () => {
  it.each([
    [400, 'VALIDATION ERROR', 'the owner cannot be a member of the library', 'Ese es tu email'],
    [400, 'VALIDATION ERROR', 'invalid body', 'Introduce un email válido.'],
    [404, 'NOT FOUND ERROR', 'user not found', 'No hay ningún usuario con ese email.'],
    [404, 'NOT FOUND ERROR', 'library not found', 'Esta biblioteca ya no existe.'],
    [409, 'CONFLICT ERROR', 'user is already a member', 'ya tiene acceso'],
    [409, 'LIBRARY MEMBERS LIMIT REACHED', '', 'más de 20 personas'],
    [429, 'TOO MANY REQUESTS ERROR', '', 'Demasiados intentos fallidos'],
    [500, 'INTERNAL SERVER ERROR', '', 'Inténtalo de nuevo'],
  ])('explains a %i %s (%s)', (status, code, message, expected) => {
    expect(inviteErrorMessage(new ApiError(status, code, message))).toContain(expected);
  });
});
