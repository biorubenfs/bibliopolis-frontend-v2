import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin, map, of } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { SpanishPaginatorIntl } from '../../../core/i18n/paginator-intl';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  toPageNumber,
  toPageSize,
} from '../../../core/pagination/pagination';
import {
  IMPORT_DIALOG_SIZE,
  ImportCsvDialog,
  ImportCsvDialogData,
} from '../../imports/import-csv-dialog/import-csv-dialog';
import { LibraryImport, isActiveImport } from '../../imports/import.model';
import { ImportsService } from '../../imports/imports.service';
import { UserBookCard } from '../../user-books/user-book-card/user-book-card';
import { UserBook } from '../../user-books/user-book.model';
import { UserBooksService } from '../../user-books/user-books.service';
import { AddBookDialog, AddBookDialogData } from '../add-book-dialog/add-book-dialog';
import {
  BookDetailDialog,
  BookDetailDialogData,
  BookDetailDialogResult,
} from '../book-detail-dialog/book-detail-dialog';
import { LibrariesService } from '../libraries.service';
import { Library } from '../library.model';
import { RemoveBookDialog, RemoveBookDialogData } from '../remove-book-dialog/remove-book-dialog';
import {
  SCAN_DIALOG_SIZE,
  ScanBooksDialog,
  ScanBooksDialogData,
} from '../scan-books-dialog/scan-books-dialog';

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error';

const DIALOG_SIZE = { width: '520px', maxWidth: 'calc(100vw - 32px)' };
const DETAIL_DIALOG_SIZE = { width: '440px', maxWidth: 'calc(100vw - 32px)' };

/**
 * A device mainly used by touch, so a phone or a tablet, with their rear camera. Screen width would
 * not tell a narrow desktop window from a phone, and webcams often cannot focus on a nearby book.
 */
const TOUCH_DEVICE_QUERY = '(hover: none) and (pointer: coarse)';

/** Shows a library and the books it contains. */
@Component({
  selector: 'app-library-detail-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    RouterLink,
    UserBookCard,
  ],
  templateUrl: './library-detail-page.html',
  styleUrl: './library-detail-page.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryDetailPage {
  private readonly librariesService = inject(LibrariesService);
  private readonly userBooksService = inject(UserBooksService);
  private readonly importsService = inject(ImportsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly addButton = viewChild('addButton', { read: ElementRef });

  /** Library ID, bound from the `:id` route param. */
  readonly id = input.required<string>();
  /** Page number starting at 1, bound from the `?page=` query param. */
  readonly page = input(1, { transform: toPageNumber });
  /** Books per page, bound from the `?limit=` query param. */
  readonly limit = input(DEFAULT_PAGE_SIZE, { transform: toPageSize });

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  protected readonly canScan = toSignal(
    inject(BreakpointObserver)
      .observe(TOUCH_DEVICE_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly library = signal<Library | null>(null);
  protected readonly books = signal<UserBook[]>([]);
  protected readonly total = signal(0);
  protected readonly state = signal<LoadState>('loading');

  /** The latest import of this library, to show how it went and link to its report. */
  protected readonly latestImport = signal<LibraryImport | null>(null);
  protected readonly latestImportActive = computed(() => {
    const latest = this.latestImport();
    return latest !== null && isActiveImport(latest);
  });

  /** The paginator counts pages from 0. */
  protected readonly pageIndex = computed(() => this.page() - 1);

  protected readonly booksLabel = computed(() => {
    const count = this.total();
    return `${count} ${count === 1 ? 'libro' : 'libros'}`;
  });

  private loadSubscription?: Subscription;
  private latestImportSubscription?: Subscription;

  constructor() {
    // The URL is the source of truth: the paginator only updates it, and the list reacts to any
    // change from any origin (paginator, reload, a link, back/forward). The router reuses this
    // component while the route stays the same, so this also covers moving to another library.
    effect(() => {
      this.id();
      this.page();
      this.limit();
      untracked(() => this.load());
    });
    effect(() => {
      this.id();
      untracked(() => this.loadLatestImport());
    });
  }

  private loadLatestImport(): void {
    this.latestImportSubscription?.unsubscribe();
    this.latestImportSubscription = this.importsService
      .listByLibrary(this.id(), { skip: 0, limit: 1 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items }) => this.latestImport.set(items[0] ?? null),
        // The books are what matters here: without this notice the page still works
        error: () => this.latestImport.set(null),
      });
  }

  protected load(): void {
    this.state.set('loading');
    const id = this.id();
    const limit = this.limit();
    if (this.library()?.id !== id) {
      this.library.set(null);
      this.total.set(0);
    }
    const library = this.library();
    // Drop the previous request so a slow, outdated page cannot overwrite newer results
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = forkJoin({
      // Changing page does not change the library: it is only requested once
      library: library ? of(library) : this.librariesService.get(id),
      page: this.userBooksService.listByLibrary(id, { skip: this.pageIndex() * limit, limit }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ library, page }) => {
          this.library.set(library);
          this.total.set(page.total);
          // A shared link may point past the end, e.g. if books were removed: show the last page.
          // Replacing the URL keeps the invalid one out of the history. This effect reloads.
          const lastPage = Math.ceil(page.total / limit);
          if (page.total > 0 && this.page() > lastPage) {
            this.updateUrl(lastPage, limit, true);
            return;
          }
          this.books.set(page.items);
          this.state.set('loaded');
        },
        error: (error: unknown) => {
          // The backend answers 403 for other users' libraries: to the user it just doesn't exist
          const notFound =
            error instanceof ApiError && (error.statusCode === 403 || error.statusCode === 404);
          this.state.set(notFound ? 'not-found' : 'error');
        },
      });
  }

  protected changePage(event: PageEvent): void {
    this.updateUrl(event.pageIndex + 1, event.pageSize);
  }

  protected openAddDialog(): void {
    this.dialog
      .open<AddBookDialog, AddBookDialogData, string>(AddBookDialog, {
        ...DIALOG_SIZE,
        data: { libraryId: this.id() },
      })
      .afterClosed()
      .subscribe((title) => {
        if (title) {
          this.notify(`«${title}» añadido a la biblioteca`);
          this.load();
          this.loadLatestImport();
        }
      });
  }

  protected openImportDialog(library: Library): void {
    this.dialog.open<ImportCsvDialog, ImportCsvDialogData, LibraryImport>(ImportCsvDialog, {
      ...IMPORT_DIALOG_SIZE,
      data: { library },
    });
  }

  protected openScanDialog(): void {
    this.dialog
      .open<ScanBooksDialog, ScanBooksDialogData, number>(ScanBooksDialog, {
        ...SCAN_DIALOG_SIZE,
        // Pressing Esc by accident would lose the summary and the pending books
        disableClose: true,
        data: { libraryId: this.id() },
      })
      .afterClosed()
      .subscribe((added) => {
        if (added) {
          this.load();
          this.loadLatestImport();
        }
      });
  }

  protected openDetailDialog(book: UserBook): void {
    this.dialog
      .open<BookDetailDialog, BookDetailDialogData, BookDetailDialogResult>(BookDetailDialog, {
        ...DETAIL_DIALOG_SIZE,
        data: { libraryId: this.id(), book },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result === 'removed') {
          this.onBookRemoved(book);
        } else if (result) {
          this.books.update((list) => list.map((item) => (item.id === result.id ? result : item)));
          this.notify('Cambios guardados');
        }
      });
  }

  protected openRemoveDialog(book: UserBook): void {
    this.dialog
      .open<RemoveBookDialog, RemoveBookDialogData, boolean>(RemoveBookDialog, {
        ...DIALOG_SIZE,
        data: { libraryId: this.id(), book },
      })
      .afterClosed()
      .subscribe((removed) => {
        if (removed) {
          this.onBookRemoved(book);
        }
      });
  }

  private onBookRemoved(book: UserBook): void {
    this.notify(`«${book.bookTitle}» quitado de la biblioteca`);
    // The button that opened the dialog is gone with its card: keep the keyboard focus nearby
    this.addButton()?.nativeElement.focus();
    this.load();
  }

  private notify(message: string): void {
    this.snackBar.open(message, undefined, { duration: 4000 });
  }

  private updateUrl(page: number, limit: number, replaceUrl = false): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        // Default values stay out of the URL to keep it short
        page: page > 1 ? page : null,
        limit: limit !== DEFAULT_PAGE_SIZE ? limit : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
}
