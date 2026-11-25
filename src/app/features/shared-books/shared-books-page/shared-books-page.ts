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
import { tap } from 'rxjs';

import { SpanishPaginatorIntl } from '../../../core/i18n/paginator-intl';
import { SearchableList } from '../../../core/lists/searchable-list';
import { SectionCounts } from '../../../core/tabbed-section/section-counts';
import { BooksViewPreference } from '../../user-books/books-view';
import { BooksViewToggle } from '../../user-books/books-view-toggle/books-view-toggle';
import { UserBookCard } from '../../user-books/user-book-card/user-book-card';
import { UserBooksTable } from '../../user-books/user-books-table/user-books-table';
import { OWN_NAME } from '../../user-books/user-book.model';
import { SharedBook, librariesLabel } from '../shared-book.model';
import {
  SHARED_BOOK_DETAIL_DIALOG_SIZE,
  SharedBookDetailDialog,
  SharedBookDetailDialogResult,
} from '../shared-book-detail-dialog/shared-book-detail-dialog';
import { SharedBooksService } from '../shared-books.service';

/** «Compartidos»: the books of all the libraries shared with the user, each one once. */
@Component({
  selector: 'app-shared-books-page',
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
  templateUrl: './shared-books-page.html',
  // The same layout as the other tab
  styleUrl: '../../user-books/my-books-page/my-books-page.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedBooksPage extends SearchableList<SharedBook> {
  private readonly sharedBooks = inject(SharedBooksService);
  private readonly counts = inject(SectionCounts);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Only the rating of the user: there may be any number of the others, shown in the detail. */
  protected readonly raters = [OWN_NAME];

  protected readonly books = computed(() =>
    this.items().map((book) => ({
      ...book,
      ratings: [{ name: OWN_NAME, own: true, value: book.own?.rating ?? null }],
      owned: book.own !== null,
      librariesLabel: librariesLabel(book.libraries),
      libraries: book.libraries.map(({ id }) => id),
    })),
  );

  protected readonly view = inject(BooksViewPreference).view;
  /** Only with books to show; it stays while a new page loads, so the list does not jump. */
  protected readonly showViewToggle = computed(
    () => this.state() !== 'error' && this.total() > 0 && this.items().length > 0,
  );

  /** Without books there is nothing to search in; with no results it stays, to change it. */
  protected readonly showSearch = computed(() => this.search() !== '' || this.total() > 0);
  /** Own books that match the search. */
  protected readonly ownMatches = this.counts.own.asReadonly();

  protected fetch(options: { skip: number; limit: number; search: string }) {
    return this.sharedBooks.list(options).pipe(
      tap({
        next: ({ total }) => this.counts.shared.set(total),
        error: () => this.counts.shared.set(null),
      }),
    );
  }

  protected openDetailDialog(id: string): void {
    const book = this.items().find((item) => item.id === id);
    if (!book) {
      return;
    }
    const dialogRef = this.dialog.open<
      SharedBookDetailDialog,
      SharedBook,
      SharedBookDetailDialogResult
    >(SharedBookDetailDialog, { ...SHARED_BOOK_DETAIL_DIALOG_SIZE, data: book });

    // Nobody shares it any more: the list behind is outdated
    dialogRef.componentInstance.notFound.subscribe(() => this.load({ quiet: true }));
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.snackBar.open(`«${book.bookTitle}» añadido a «${result.addedTo}»`, undefined, {
          duration: 4000,
        });
        // The user may already have had an opinion of the book, which is shown again
        this.load({ quiet: true });
        this.counts.recountOther();
      }
    });
  }
}
