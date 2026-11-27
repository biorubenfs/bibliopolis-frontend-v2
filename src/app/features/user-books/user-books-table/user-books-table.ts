import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { RatingValue } from '../rating-value/rating-value';
import { ReadingStatusBadge } from '../reading-status-badge/reading-status-badge';
import { ListedBook, PersonRating } from '../user-book.model';
import { TruncatedTooltip } from './truncated-tooltip';

/** The same books as the cards, in rows: denser, to scan long lists. */
@Component({
  selector: 'app-user-books-table',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    RatingValue,
    ReadingStatusBadge,
    TruncatedTooltip,
  ],
  templateUrl: './user-books-table.html',
  styleUrl: './user-books-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserBooksTable<T extends ListedBook> {
  readonly books = input.required<T[]>();
  /** Offers removing each book from the library being shown. */
  readonly removable = input(true);
  /** Shows how many libraries contain each book, for lists that span several of them. */
  readonly showLibraryCount = input(false);
  /**
   * Shows one column with the ratings of each of these people, in the order of the `ratings` of the
   * books, instead of the column with the rating of the user.
   */
  readonly raters = input<readonly string[]>([]);
  /**
   * Shows a small cover on each row. Off for now: without images the page loads faster and the rows
   * are lower, so more books fit on screen. The column is kept in case it is wanted back.
   */
  readonly showCover = input(false);
  /** Shows the reading status of the user, in their own lists. */
  readonly showReadingStatus = input(false);

  readonly openRequested = output<T>();
  readonly removeRequested = output<T>();

  /** With several people, narrow frames stack their ratings in one column to make room. */
  protected readonly stacksRatings = computed(() => this.raters().length > 1);

  private readonly ratingColumns = computed(() => {
    if (this.raters().length === 0) {
      return ['rating'];
    }
    return [
      ...this.raters().map((_, index) => this.raterColumn(index)),
      ...(this.stacksRatings() ? ['ratings'] : []),
    ];
  });

  protected readonly columns = computed(() => [
    ...(this.showCover() ? ['cover'] : []),
    'title',
    'authors',
    ...this.ratingColumns(),
    ...(this.showReadingStatus() ? ['readingStatus'] : []),
    ...(this.showLibraryCount() ? ['libraries'] : []),
    'isbn',
    'isbn10',
    ...(this.removable() ? ['actions'] : []),
  ]);

  /** Covers come from external services, so a URL may stop working: show the placeholder then. */
  protected readonly failedCovers = signal<ReadonlySet<string>>(new Set());

  protected raterColumn(index: number): string {
    return `rater${index}`;
  }

  protected personRating(book: T, index: number): PersonRating | undefined {
    return book.ratings?.[index];
  }

  protected authors(book: T): string {
    return book.bookAuthors.join(', ') || 'Autor desconocido';
  }

  protected libraryCount(book: T): string {
    const count = book.libraries?.length ?? 0;
    return `${count} ${count === 1 ? 'biblioteca' : 'bibliotecas'}`;
  }

  protected onCoverError(book: T): void {
    this.failedCovers.update((ids) => new Set(ids).add(book.id));
  }

  protected remove(book: T, event: Event): void {
    // The row opens the book: the click must stop at the button
    event.stopPropagation();
    this.removeRequested.emit(book);
  }
}
