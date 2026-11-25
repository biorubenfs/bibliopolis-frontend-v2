import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TruncatedTooltip } from '../user-books-table/truncated-tooltip';

/** A rating, such as «★ 9/10», optionally with the name of who gave it: «Ana ★ 9/10». */
@Component({
  selector: 'app-rating-value',
  imports: [MatIconModule, MatTooltipModule, TruncatedTooltip],
  template: `
    @if (showName()) {
      <span class="name" appTruncatedTooltip [matTooltip]="name() ?? ''">{{ name() }}</span>
    }
    <mat-icon aria-hidden="true">star</mat-icon>
    <span>{{ value() }}/10</span>
  `,
  styleUrl: './rating-value.scss',
  host: {
    // Read as a whole: the star is the only hint of what the number means
    role: 'img',
    '[attr.aria-label]': 'description()',
    '[class.own]': 'own() && name() !== null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingValue {
  /** From 1 to 10. */
  readonly value = input.required<number>();
  /** Who gave the rating. Without it, it is clear from where it is shown. */
  readonly name = input<string | null>(null);
  /** It is the rating of the user. */
  readonly own = input(false);
  /** The name may already be visible, e.g. in the header of a column. */
  readonly showName = input(false);

  protected readonly description = computed(() => {
    const value = `${this.value()} de 10`;
    if (this.own()) {
      return `Tu valoración: ${value}`;
    }
    const name = this.name();
    return name ? `Valoración de ${name}: ${value}` : `Valoración: ${value}`;
  });
}
