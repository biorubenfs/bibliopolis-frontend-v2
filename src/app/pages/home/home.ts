import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

/** Temporary landing page to check the login flow; it will be replaced by the real layout. */
@Component({
  selector: 'app-home',
  imports: [MatButtonModule],
  template: `
    <main>
      <h1>Estás logueado</h1>
      <button mat-stroked-button type="button" (click)="logout()">Cerrar sesión</button>
    </main>
  `,
  styles: `
    main {
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 24px;
      min-height: 100dvh;
      background: var(--mat-sys-surface);
    }

    h1 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
      color: var(--mat-sys-on-surface);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
