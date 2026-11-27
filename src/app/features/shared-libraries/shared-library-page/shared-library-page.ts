import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin, map, tap } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { Page } from '../../../core/http/api.models';
import { SpanishPaginatorIntl } from '../../../core/i18n/paginator-intl';
import { SearchableList } from '../../../core/lists/searchable-list';
import { PublicBadge } from '../../libraries/public-badge/public-badge';
import { BooksViewPreference } from '../../user-books/books-view';
import { BooksViewToggle } from '../../user-books/books-view-toggle/books-view-toggle';
import { UserBookCard } from '../../user-books/user-book-card/user-book-card';
import { UserBooksTable } from '../../user-books/user-books-table/user-books-table';
import { SharedLibrariesService } from '../shared-libraries.service';
import { SharedLibrary, SharedLibraryBook, personRatings, raters } from '../shared-library.model';
import {
  SHARED_BOOK_DIALOG_SIZE,
  SharedBookDialog,
  SharedBookDialogData,
  SharedBookDialogResult,
} from '../shared-book-dialog/shared-book-dialog';

/** The tab of «Bibliotecas» the page was opened from: the link back goes to it. */
export type SharedLibrarySection = 'shared' | 'public';

const SECTIONS: Record<SharedLibrarySection, { path: string; label: string }> = {
  shared: { path: '/libraries/shared', label: 'Compartidas conmigo' },
  public: { path: '/libraries/public', label: 'Públicas' },
};

/** A library of another user and its books, in read-only: shared with the user, or public. */
@Component({
  selector: 'app-shared-library-page',
  imports: [
    BooksViewToggle,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    PublicBadge,
    RouterLink,
    UserBookCard,
    UserBooksTable,
  ],
  templateUrl: './shared-library-page.html',
  styleUrl: './shared-library-page.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedLibraryPage extends SearchableList<SharedLibraryBook> {
  private readonly sharedLibraries = inject(SharedLibrariesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Library ID, bound from the `:id` route param. */
  readonly id = input.required<string>();
  /**
   * Bound from the data of the route. The router sets it to undefined on the routes without it, so
   * a default value would not apply: they are the shared ones.
   */
  readonly section = input<SharedLibrarySection | undefined>();
  protected readonly back = computed(() => SECTIONS[this.section() ?? 'shared']);

  protected readonly library = signal<SharedLibrary | null>(null);
  /** Without access, the library does not exist for the user. */
  protected readonly notFound = signal(false);

  protected readonly view = inject(BooksViewPreference).view;
  /** Only with books to show; it stays while a new page loads, so the list does not jump. */
  protected readonly showViewToggle = computed(
    () => this.state() !== 'error' && this.total() > 0 && this.items().length > 0,
  );

  protected readonly raters = computed(() => {
    const library = this.library();
    return library ? raters(library) : [];
  });
  /** The books with whose ratings are shown for them. */
  protected readonly books = computed(() => {
    const library = this.library();
    return library
      ? this.items().map((book) => ({ ...book, ratings: personRatings(library, book) }))
      : [];
  });

  protected readonly booksLabel = computed(() => {
    const count = this.total();
    if (this.search()) {
      return `${count} ${count === 1 ? 'resultado' : 'resultados'}`;
    }
    return `${count} ${count === 1 ? 'libro' : 'libros'}`;
  });

  /**
   * Hide the search while the library has no books at all. It stays visible with no results, so
   * the user can change it.
   */
  protected readonly showSearch = computed(() => this.search() !== '' || this.total() > 0);

  /** The library of the last request. */
  private requestedId?: string;

  constructor() {
    super();
    // The router reuses this component when moving from one library to another, e.g. with the
    // history: the base list only follows the search and the page
    effect(() => {
      const id = this.id();
      untracked(() => {
        if (this.requestedId !== undefined && this.requestedId !== id) {
          this.library.set(null);
          this.items.set([]);
          this.total.set(0);
          this.load();
        }
      });
    });
  }

  /** The library is requested along with each page: its owner may change what they share. */
  protected fetch(options: {
    skip: number;
    limit: number;
    search: string;
  }): Observable<Page<SharedLibraryBook>> {
    const id = this.id();
    this.requestedId = id;
    return forkJoin({
      library: this.sharedLibraries.get(id),
      page: this.sharedLibraries.listBooks(id, options),
    }).pipe(
      tap({
        next: ({ library }) => {
          this.library.set(library);
          this.notFound.set(false);
        },
        error: (error: unknown) => {
          const notFound = error instanceof ApiError && error.statusCode === 404;
          this.notFound.set(notFound);
          // The access may be lost with the page open: nothing of the library must remain
          if (notFound) {
            this.library.set(null);
            this.items.set([]);
            this.total.set(0);
          }
        },
      }),
      map(({ page }) => page),
    );
  }

  protected openBookDialog(library: SharedLibrary, book: SharedLibraryBook): void {
    this.dialog
      .open<SharedBookDialog, SharedBookDialogData, SharedBookDialogResult>(SharedBookDialog, {
        ...SHARED_BOOK_DIALOG_SIZE,
        data: { library, book },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.snackBar.open(`«${book.bookTitle}» añadido a «${result.addedTo}»`, undefined, {
            duration: 4000,
          });
          // The user may already have had an opinion of the book, which is shown again
          this.load({ quiet: true });
        }
      });
  }
}
