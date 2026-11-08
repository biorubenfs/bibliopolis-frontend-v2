import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router, UrlTree, provideRouter } from '@angular/router';

import { UserRole } from '../users/user.model';
import { adminGuard, authGuard, guestGuard, regularGuard } from './auth.guards';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  function run(guard: CanActivateFn, session: { authenticated: boolean; role: UserRole | null }) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => session.authenticated,
            role: () => session.role,
            homeUrl: () => (session.role === 'admin' ? '/backoffice' : '/libraries'),
          },
        },
      ],
    });
    const result = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;
  }

  const admin = { authenticated: true, role: 'admin' as const };
  const regular = { authenticated: true, role: 'regular' as const };
  const guest = { authenticated: false, role: null };

  it('sends a guest to the login page', () => {
    expect(run(authGuard, guest)).toBe('/login');
    expect(run(authGuard, regular)).toBe(true);
  });

  it('sends a logged in user from the login page to their home page', () => {
    expect(run(guestGuard, guest)).toBe(true);
    expect(run(guestGuard, regular)).toBe('/libraries');
    expect(run(guestGuard, admin)).toBe('/backoffice');
  });

  it('only lets admins into the backoffice', () => {
    expect(run(adminGuard, admin)).toBe(true);
    expect(run(adminGuard, regular)).toBe('/libraries');
  });

  it('sends an admin from the reader screens to the backoffice', () => {
    expect(run(regularGuard, regular)).toBe(true);
    expect(run(regularGuard, admin)).toBe('/backoffice');
  });
});
