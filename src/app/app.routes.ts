import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guards';

const comingSoon = () => import('./pages/coming-soon/coming-soon').then((m) => m.ComingSoon);

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Iniciar sesión · Bibliopolis',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
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
        path: 'books',
        title: 'Mis libros · Bibliopolis',
        data: { heading: 'Mis libros' },
        loadComponent: comingSoon,
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
        data: { heading: 'Perfil' },
        loadComponent: comingSoon,
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
