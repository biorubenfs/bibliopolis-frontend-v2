import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { READING_STATUSES, ReadingStatus } from '../user-book.model';

/** A small tonal pill with the reading status of a book, such as «✓ Leído». */
@Component({
  selector: 'app-reading-status-badge',
  imports: [MatIconModule],
  template: `
    <mat-icon aria-hidden="true">{{ option().icon }}</mat-icon>
    <span class="label">{{ option().label }}</span>
  `,
  styleUrl: './reading-status-badge.scss',
  host: {
    // The colour is never the only hint: the icon and the text say it too
    '[class]': 'status()',
    // Read as a whole, also when the text is hidden in compact tables
    role: 'img',
    '[attr.aria-label]': 'option().label',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadingStatusBadge {
  readonly status = input.required<ReadingStatus>();

  protected readonly option = computed(
    () => READING_STATUSES.find(({ value }) => value === this.status()) ?? READING_STATUSES[0],
  );
}
