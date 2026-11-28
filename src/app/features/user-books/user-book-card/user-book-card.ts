import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { RatingValue } from '../rating-value/rating-value';
import { ReadingStatusBadge } from '../reading-status-badge/reading-status-badge';
import { ListedBook } from '../user-book.model';

@Component({
  selector: 'app-user-book-card',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, RatingValue, ReadingStatusBadge],
  templateUrl: './user-book-card.html',
  styleUrl: './user-book-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserBookCard {
  readonly book = input.required<ListedBook>();
  /** Offers removing the book from the library being shown. */
  readonly removable = input(true);
  /** Offers adding the book to libraries of the user. */
  readonly addable = input(false);
  /** The tooltip of the add button, which says where the book is added. */
  readonly addLabel = input('Añadir a otra biblioteca');
  /** Shows how many libraries contain the book, for lists that span several of them. */
  readonly showLibraryCount = input(false);

  readonly openRequested = output<void>();
  readonly addRequested = output<void>();
  readonly removeRequested = output<void>();

  /** Covers come from external services, so a URL may stop working: show the placeholder then. */
  protected readonly coverFailed = signal(false);

  protected readonly authors = computed(
    () => this.book().bookAuthors.join(', ') || 'Autor desconocido',
  );

  /** The ratings of several people; those who have not rated the book are left out. */
  protected readonly personRatings = computed(() =>
    (this.book().ratings ?? []).flatMap(({ name, own, value }) =>
      value === null ? [] : [{ name, own, value }],
    ),
  );

  protected readonly libraryCountLabel = computed(() => {
    const count = this.book().libraries?.length ?? 0;
    return `En ${count} ${count === 1 ? 'biblioteca' : 'bibliotecas'}`;
  });
}
