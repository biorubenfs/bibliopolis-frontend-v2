import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { map } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

const READER_NAV: NavItem[] = [
  { label: 'Mis bibliotecas', icon: 'shelves', path: '/libraries' },
  { label: 'Mis libros', icon: 'menu_book', path: '/books' },
  { label: 'Explorar', icon: 'explore', path: '/explore' },
];

const BACKOFFICE_NAV: NavItem[] = [
  { label: 'Libros', icon: 'library_books', path: '/backoffice/books' },
  { label: 'Usuarios', icon: 'group', path: '/backoffice/users' },
];

/** Desktop breakpoint: the sidebar stays open next to the content. */
const DESKTOP_QUERY = '(min-width: 900px)';

@Component({
  selector: 'app-shell',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** The same layout serves the reader screens and the backoffice, set by the route data. */
  protected readonly isBackoffice = inject(ActivatedRoute).snapshot.data['area'] === 'backoffice';
  protected readonly navItems = this.isBackoffice ? BACKOFFICE_NAV : READER_NAV;
  protected readonly profilePath = this.isBackoffice ? '/backoffice/profile' : '/profile';

  protected readonly isDesktop = toSignal(
    inject(BreakpointObserver)
      .observe(DESKTOP_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly user = this.auth.currentUser;
  protected readonly avatarUrl = computed(() => {
    const avatar = this.user()?.avatar;
    return avatar ? `data:image/png;base64,${avatar}` : null;
  });
  protected readonly initial = computed(() => this.user()?.name.charAt(0).toUpperCase() ?? '');

  constructor() {
    if (!this.user()) {
      // A 401 is handled by the auth interceptor; other errors just leave the avatar empty
      this.auth.loadCurrentUser().subscribe({ error: () => undefined });
    }
  }

  /** On mobile the sidebar is an overlay, so it is closed after choosing a destination. */
  protected closeOnMobile(sidenav: MatSidenav): void {
    if (!this.isDesktop()) {
      void sidenav.close();
    }
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
