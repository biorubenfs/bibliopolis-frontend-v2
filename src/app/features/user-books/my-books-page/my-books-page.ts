import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';

import { SpanishPaginatorIntl } from '../../../core/i18n/paginator-intl';
import { SearchableList } from '../../../core/lists/searchable-list';
import {
  BookDetailDialog,
  BookDetailDialogData,
  BookDetailDialogResult,
} from '../../libraries/book-detail-dialog/book-detail-dialog';
import { BooksViewPreference } from '../books-view';
import { BooksViewToggle } from '../books-view-toggle/books-view-toggle';
import {
  ReadingStatusFilter,
  ReadingStatusFilterChange,
  STATUS_QUERY_PARAM,
  YEAR_QUERY_PARAM,
  toReadYear,
  toStatusQuery,
} from '../reading-status-filter/reading-status-filter';
import { UserBookCard } from '../user-book-card/user-book-card';
import { UserBook } from '../user-book.model';
import { UserBooksService } from '../user-books.service';
import { UserBooksTable } from '../user-books-table/user-books-table';

const DETAIL_DIALOG_SIZE = { width: '440px', maxWidth: 'calc(100vw - 32px)' };

/**
 * Shows the books in any library of the user, with a search by title, author or ISBN and a filter
 * by reading status. A book may be in several libraries, so here it can be edited but not removed.
 */
@Component({
  selector: 'app-my-books-page',
  imports: [
    BooksViewToggle,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    ReadingStatusFilter,
    RouterLink,
    UserBookCard,
    UserBooksTable,
  ],
  templateUrl: './my-books-page.html',
  styleUrl: './my-books-page.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyBooksPage extends SearchableList<UserBook> {
  private readonly userBooksService = inject(UserBooksService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly view = inject(BooksViewPreference).view;

  protected override readonly filterParams = [STATUS_QUERY_PARAM, YEAR_QUERY_PARAM];
  protected readonly readingStatus = computed(() =>
    toStatusQuery(this.filters()[STATUS_QUERY_PARAM]),
  );
  /** Only applies to the read books. */
  protected readonly readYear = computed(() =>
    this.readingStatus() === 'read' ? toReadYear(this.filters()[YEAR_QUERY_PARAM]) : null,
  );
  /** Some filter or search narrows the list. */
  protected readonly filtered = computed(() => this.search() !== '' || this.readingStatus() !== '');

  /** Only with books to show; it stays while a new page loads, so the list does not jump. */
  protected readonly showViewToggle = computed(
    () => this.state() !== 'error' && this.total() > 0 && this.items().length > 0,
  );

  protected readonly countLabel = computed(() => {
    const count = this.total();
    if (this.filtered()) {
      return `${count} ${count === 1 ? 'resultado' : 'resultados'}`;
    }
    return `${count} ${count === 1 ? 'libro' : 'libros'}`;
  });

  /**
   * Hide the search and the filter while the user has no books at all. They stay visible with no
   * results, so the user can change them.
   */
  protected readonly showSearch = computed(() => this.filtered() || this.total() > 0);

  /** What the empty list says when only the reading status filter is applied. */
  protected readonly emptyStatusMessage = computed(() => {
    const year = this.readYear();
    switch (this.readingStatus()) {
      case 'to_read':
        return 'No tienes libros pendientes';
      case 'reading':
        return 'No estás leyendo ningún libro';
      case 'read':
        return year ? `No tienes libros leídos en ${year}` : 'No tienes libros leídos';
      default:
        return 'No tienes libros sin estado';
    }
  });

  protected fetch(options: { skip: number; limit: number; search: string }) {
    return this.userBooksService.list({
      ...options,
      readingStatus: this.readingStatus(),
      readYear: this.readYear(),
    });
  }

  protected changeReadingStatus({ status, year }: ReadingStatusFilterChange): void {
    this.updateFilters({
      [STATUS_QUERY_PARAM]: status,
      [YEAR_QUERY_PARAM]: year?.toString() ?? '',
    });
  }

  protected openDetailDialog(book: UserBook): void {
    this.dialog
      .open<BookDetailDialog, BookDetailDialogData, BookDetailDialogResult>(BookDetailDialog, {
        ...DETAIL_DIALOG_SIZE,
        data: { book },
      })
      .afterClosed()
      .subscribe((result) => {
        // Without a library the dialog does not offer removing the book
        if (result && result !== 'removed') {
          // With the filter, a book whose status changed may no longer belong to the list
          if (this.readingStatus()) {
            this.load({ quiet: true });
          } else {
            this.replaceItem(result);
          }
          this.snackBar.open('Cambios guardados', undefined, { duration: 4000 });
        }
      });
  }
}
