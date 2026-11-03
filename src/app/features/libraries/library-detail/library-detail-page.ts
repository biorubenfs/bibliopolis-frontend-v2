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
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { SpanishPaginatorIntl } from '../../../core/i18n/paginator-intl';
import { UserBookCard } from '../../user-books/user-book-card/user-book-card';
import { UserBook } from '../../user-books/user-book.model';
import { UserBooksService } from '../../user-books/user-books.service';
import { LibrariesService } from '../libraries.service';
import { Library } from '../library.model';

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error';

const PAGE_SIZE_OPTIONS = [12, 24, 48];
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

/** Anyone can edit the URL: anything that is not a valid page number means the first page. */
function toPageNumber(value: string | undefined): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

function toPageSize(value: string | undefined): number {
  const size = Number(value);
  return PAGE_SIZE_OPTIONS.includes(size) ? size : DEFAULT_PAGE_SIZE;
}

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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** Library ID, bound from the `:id` route param. */
  readonly id = input.required<string>();
  /** Page number starting at 1, bound from the `?page=` query param. */
  readonly page = input(1, { transform: toPageNumber });
  /** Books per page, bound from the `?limit=` query param. */
  readonly limit = input(DEFAULT_PAGE_SIZE, { transform: toPageSize });

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  protected readonly library = signal<Library | null>(null);
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
    // change from any origin (paginator, reload, a link, back/forward). The router reuses this
    // component while the route stays the same, so this also covers moving to another library.
    effect(() => {
      this.id();
      this.page();
      this.limit();
      untracked(() => this.load());
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
