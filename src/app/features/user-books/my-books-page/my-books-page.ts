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
import { UserBookCard } from '../user-book-card/user-book-card';
import { UserBook } from '../user-book.model';
import { UserBooksService } from '../user-books.service';
import { UserBooksTable } from '../user-books-table/user-books-table';

const DETAIL_DIALOG_SIZE = { width: '440px', maxWidth: 'calc(100vw - 32px)' };

/**
 * Shows the books in any library of the user, with a search by title, author or ISBN. A book may
 * be in several libraries, so here it can be edited but not removed.
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
  /** Only with books to show; it stays while a new page loads, so the list does not jump. */
  protected readonly showViewToggle = computed(
    () => this.state() !== 'error' && this.total() > 0 && this.items().length > 0,
  );

  protected readonly countLabel = computed(() => {
    const count = this.total();
    if (this.search()) {
      return `${count} ${count === 1 ? 'resultado' : 'resultados'}`;
    }
    return `${count} ${count === 1 ? 'libro' : 'libros'}`;
  });

  /**
   * Hide the search while the user has no books at all. It stays visible with no results, so the
   * user can change it.
   */
  protected readonly showSearch = computed(() => this.search() !== '' || this.total() > 0);

  protected fetch(options: { skip: number; limit: number; search: string }) {
    return this.userBooksService.list(options);
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
          this.replaceItem(result);
          this.snackBar.open('Cambios guardados', undefined, { duration: 4000 });
        }
      });
  }
}
