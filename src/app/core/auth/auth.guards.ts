import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Only lets authenticated users through; otherwise redirects to the login page. */
export const authGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() || inject(Router).createUrlTree(['/login']);

/** Keeps authenticated users away from the login page. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.isAuthenticated() || inject(Router).createUrlTree([auth.homeUrl()]);
};

/** The backoffice is only for admins: a regular user goes to their libraries. */
export const adminGuard: CanActivateFn = () =>
  inject(AuthService).role() === 'admin' || inject(Router).createUrlTree(['/libraries']);

/** Admins have no libraries: they go to the backoffice. */
export const regularGuard: CanActivateFn = () =>
  inject(AuthService).role() !== 'admin' || inject(Router).createUrlTree(['/backoffice']);
