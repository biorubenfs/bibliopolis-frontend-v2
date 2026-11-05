import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { SpanishPaginatorIntl } from '../../../core/i18n/paginator-intl';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  toPageNumber,
  toPageSize,
} from '../../../core/pagination/pagination';
import {
  BookDetailDialog,
  BookDetailDialogData,
  BookDetailDialogResult,
} from '../../libraries/book-detail-dialog/book-detail-dialog';
import { UserBookCard } from '../user-book-card/user-book-card';
import { UserBook } from '../user-book.model';
import { UserBooksService } from '../user-books.service';

type LoadState = 'loading' | 'loaded' | 'error';

const DETAIL_DIALOG_SIZE = { width: '440px', maxWidth: 'calc(100vw - 32px)' };

/**
 * Shows the books in any library of the user. A book may be in several libraries, so here it can be
 * edited but not removed.
 */
@Component({
  selector: 'app-my-books-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    RouterLink,
    UserBookCard,
  ],
  templateUrl: './my-books-page.html',
  styleUrl: './my-books-page.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyBooksPage {
  private readonly userBooksService = inject(UserBooksService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Page number starting at 1, bound from the `?page=` query param. */
  readonly page = input(1, { transform: toPageNumber });
  /** Books per page, bound from the `?limit=` query param. */
  readonly limit = input(DEFAULT_PAGE_SIZE, { transform: toPageSize });

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  protected readonly books = signal<UserBook[]>([]);
  protected readonly total = signal(0);
  protected readonly state = signal<LoadState>('loading');

  /** The paginator counts pages from 0. */
  protected readonly pageIndex = computed(() => this.page() - 1);

  protected readonly booksLabel = computed(() => {
    const count = this.total();
    return `${count} ${count === 1 ? 'libro' : 'libros'}`;
  });

  private loadSubscription?: Subscription;

  constructor() {
    // The URL is the source of truth: the paginator only updates it, and the list reacts to any
    // change from any origin (paginator, reload, a link, back/forward).
    effect(() => {
      this.page();
      this.limit();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    this.state.set('loading');
    const limit = this.limit();
    // Drop the previous request so a slow, outdated page cannot overwrite newer results
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.userBooksService
      .list({ skip: this.pageIndex() * limit, limit })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.total.set(page.total);
          // A shared link may point past the end, e.g. if books were removed: show the last page.
          // Replacing the URL keeps the invalid one out of the history. The effect reloads.
          const lastPage = Math.ceil(page.total / limit);
          if (page.total > 0 && this.page() > lastPage) {
            this.updateUrl(lastPage, limit, true);
            return;
          }
          this.books.set(page.items);
          this.state.set('loaded');
        },
        error: () => this.state.set('error'),
      });
  }

  protected changePage(event: PageEvent): void {
    this.updateUrl(event.pageIndex + 1, event.pageSize);
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
          this.books.update((list) => list.map((item) => (item.id === result.id ? result : item)));
          this.snackBar.open('Cambios guardados', undefined, { duration: 4000 });
        }
      });
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
