import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { UserBook } from '../user-book.model';

@Component({
  selector: 'app-user-book-card',
  imports: [MatIconModule],
  templateUrl: './user-book-card.html',
  styleUrl: './user-book-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserBookCard {
  readonly book = input.required<UserBook>();

  /** Covers come from external services, so a URL may stop working: show the placeholder then. */
  protected readonly coverFailed = signal(false);

  protected readonly authors = computed(
    () => this.book().bookAuthors.join(', ') || 'Autor desconocido',
  );
}
