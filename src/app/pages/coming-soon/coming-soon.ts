import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Placeholder for sections that are not implemented yet. The heading comes from the route data. */
@Component({
  selector: 'app-coming-soon',
  imports: [MatIconModule],
  template: `
    <h1>{{ heading() }}</h1>
    <div class="body">
      <mat-icon aria-hidden="true">construction</mat-icon>
      <p>Esta sección estará disponible próximamente.</p>
    </div>
  `,
  styles: `
    :host {
      display: block;
      padding: 24px 16px;
    }

    h1 {
      margin: 0 0 24px;
      font: 500 2rem / 1.25 var(--app-font-display);
      color: var(--mat-sys-on-surface);
    }

    .body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 64px 16px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-large);
    }

    mat-icon {
      width: 48px;
      height: 48px;
      font-size: 48px;
      color: var(--mat-sys-secondary);
    }

    p {
      margin: 0;
    }

    @media (min-width: 900px) {
      :host {
        padding: 40px 48px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoon {
  readonly heading = input.required<string>();
}
