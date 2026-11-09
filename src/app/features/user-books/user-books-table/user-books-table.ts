import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import { UserBook } from '../user-book.model';
import { TruncatedTooltip } from './truncated-tooltip';

/** The same books as the cards, in rows: denser, to scan long lists. */
@Component({
  selector: 'app-user-books-table',
  imports: [MatButtonModule, MatIconModule, MatTableModule, MatTooltipModule, TruncatedTooltip],
  templateUrl: './user-books-table.html',
  styleUrl: './user-books-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserBooksTable {
  readonly books = input.required<UserBook[]>();
  /** Offers removing each book from the library being shown. */
  readonly removable = input(true);
  /** Shows how many libraries contain each book, for lists that span several of them. */
  readonly showLibraryCount = input(false);
  /**
   * Shows a small cover on each row. Off for now: without images the page loads faster and the rows
   * are lower, so more books fit on screen. The column is kept in case it is wanted back.
   */
  readonly showCover = input(false);

  readonly openRequested = output<UserBook>();
  readonly removeRequested = output<UserBook>();

  protected readonly columns = computed(() => [
    ...(this.showCover() ? ['cover'] : []),
    'title',
    'authors',
    'rating',
    ...(this.showLibraryCount() ? ['libraries'] : []),
    'isbn',
    'isbn10',
    ...(this.removable() ? ['actions'] : []),
  ]);

  /** Covers come from external services, so a URL may stop working: show the placeholder then. */
  protected readonly failedCovers = signal<ReadonlySet<string>>(new Set());

  protected authors(book: UserBook): string {
    return book.bookAuthors.join(', ') || 'Autor desconocido';
  }

  protected libraryCount(book: UserBook): string {
    const count = book.libraries.length;
    return `${count} ${count === 1 ? 'biblioteca' : 'bibliotecas'}`;
  }

  protected onCoverError(book: UserBook): void {
    this.failedCovers.update((ids) => new Set(ids).add(book.id));
  }

  protected remove(book: UserBook, event: Event): void {
    // The row opens the book: the click must stop at the button
    event.stopPropagation();
    this.removeRequested.emit(book);
  }
}
