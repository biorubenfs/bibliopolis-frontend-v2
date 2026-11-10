import { Routes } from '@angular/router';

import { adminGuard, authGuard, guestGuard, regularGuard } from './core/auth/auth.guards';

const comingSoon = () => import('./pages/coming-soon/coming-soon').then((m) => m.ComingSoon);

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Iniciar sesión · Bibliopolis',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'backoffice',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    data: { area: 'backoffice' },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'books' },
      {
        path: 'books',
        title: 'Libros · Backoffice · Bibliopolis',
        loadComponent: () =>
          import('./features/backoffice/books/backoffice-books-page').then(
            (m) => m.BackofficeBooksPage,
          ),
      },
      {
        path: 'users',
        title: 'Usuarios · Backoffice · Bibliopolis',
        loadComponent: () =>
          import('./features/backoffice/users/backoffice-users-page').then(
            (m) => m.BackofficeUsersPage,
          ),
      },
      {
        path: 'users/:id',
        title: 'Estadísticas del usuario · Backoffice · Bibliopolis',
        loadComponent: () =>
          import('./features/backoffice/users/user-stats/backoffice-user-stats-page').then(
            (m) => m.BackofficeUserStatsPage,
          ),
      },
      {
        path: 'profile',
        title: 'Perfil · Bibliopolis',
        loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard, regularGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'libraries' },
      {
        path: 'libraries',
        title: 'Mis bibliotecas · Bibliopolis',
        loadComponent: () =>
          import('./features/libraries/libraries-page').then((m) => m.LibrariesPage),
      },
      {
        path: 'libraries/:id',
        title: 'Biblioteca · Bibliopolis',
        loadComponent: () =>
          import('./features/libraries/library-detail/library-detail-page').then(
            (m) => m.LibraryDetailPage,
          ),
      },
      {
        path: 'libraries/:id/imports/:importId',
        title: 'Importación · Bibliopolis',
        loadComponent: () =>
          import('./features/imports/import-report-page/import-report-page').then(
            (m) => m.ImportReportPage,
          ),
      },
      {
        path: 'books',
        title: 'Mis libros · Bibliopolis',
        loadComponent: () =>
          import('./features/user-books/my-books-page/my-books-page').then((m) => m.MyBooksPage),
      },
      {
        path: 'explore',
        title: 'Explorar · Bibliopolis',
        data: { heading: 'Explorar' },
        loadComponent: comingSoon,
      },
      {
        path: 'profile',
        title: 'Perfil · Bibliopolis',
        loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
