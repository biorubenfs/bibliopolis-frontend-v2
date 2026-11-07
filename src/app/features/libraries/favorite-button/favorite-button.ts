import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Toggle button that marks a library as favorite. It uses a bookmark, not a star, because the star
 * is already the rating of a book.
 */
@Component({
  selector: 'app-favorite-button',
  imports: [MatButtonModule, MatTooltipModule],
  template: `
    <button
      mat-icon-button
      type="button"
      class="favorite"
      [class.active]="favorite()"
      [matTooltip]="tooltip()"
      [attr.aria-label]="'Marcar ' + libraryName() + ' como favorita'"
      [attr.aria-pressed]="favorite()"
      [disabled]="busy()"
      (click)="toggled.emit()"
    >
      <!-- An inline SVG because the icon font is loaded without its filled variant -->
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-2.6L6 20V5a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  `,
  styles: `
    .icon {
      display: block;
      width: 24px;
      height: 24px;
    }

    path {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linejoin: round;
    }

    .active {
      color: var(--mat-sys-primary);

      path {
        fill: currentColor;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoriteButton {
  readonly favorite = input.required<boolean>();
  /** Name of the library, for the accessible label. */
  readonly libraryName = input.required<string>();
  /** True while the change is being saved. */
  readonly busy = input(false);

  readonly toggled = output<void>();

  protected readonly tooltip = computed(() =>
    this.favorite() ? 'Quitar de favoritas' : 'Marcar como favorita',
  );
}
