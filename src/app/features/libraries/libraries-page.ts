import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged, map } from 'rxjs';

import { saveFile } from '../../core/files/save-file';
import { SpanishPaginatorIntl } from '../../core/i18n/paginator-intl';
import { DeleteLibraryDialog } from './delete-library-dialog/delete-library-dialog';
import { LibrariesService } from './libraries.service';
import { LibraryCard } from './library-card/library-card';
import {
  LibraryFormDialog,
  LibraryFormDialogData,
} from './library-form-dialog/library-form-dialog';
import { LIBRARY_SEARCH_MAX_LENGTH, Library, LibraryExportFormat } from './library.model';

type LoadState = 'loading' | 'loaded' | 'error';

const DIALOG_SIZE = { width: '520px', maxWidth: 'calc(100vw - 32px)' };

/** Wait this long after the last keystroke before searching, to avoid one request per key. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Query param that keeps the search in the URL (survives reloads and back/forward). */
export const SEARCH_QUERY_PARAM = 'q';

const PAGE_QUERY_PARAM = 'page';
const LIMIT_QUERY_PARAM = 'limit';

const PAGE_SIZE_OPTIONS = [12, 24, 48];
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

/** Anyone can edit the URL: anything that is not a valid page number means the first page. */
function toPageNumber(value: string | null): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

function toPageSize(value: string | null): number {
  const size = Number(value);
  return PAGE_SIZE_OPTIONS.includes(size) ? size : DEFAULT_PAGE_SIZE;
}

@Component({
  selector: 'app-libraries-page',
  imports: [
    LibraryCard,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './libraries-page.html',
  styleUrl: './libraries-page.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibrariesPage {
  private readonly librariesService = inject(LibrariesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly searchMaxLength = LIBRARY_SEARCH_MAX_LENGTH;

  protected readonly libraries = signal<Library[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly state = signal<LoadState>('loading');
  protected readonly exportingId = signal<string | null>(null);
  /** Text in the search field, updated on every keystroke. */
  protected readonly query = signal('');
  /** Search applied to the list (debounced and trimmed). */
  protected readonly search = signal('');
  /** Hide the search field while the user has no libraries at all. */
  protected readonly showSearch = computed(() => this.search() !== '' || this.total() > 0);

  private readonly searchInput = new Subject<string>();
  private loadSubscription?: Subscription;

  constructor() {
    // The URL is the source of truth: typing and the paginator only update ?q=, ?page= and
    // ?limit=, and the list reacts to changes from any origin (typing, paginator, reload, a link,
    // back/forward). Its first emission performs the initial load.
    this.route.queryParamMap
      .pipe(
        map((params) => ({
          term: (params.get(SEARCH_QUERY_PARAM) ?? '').trim().slice(0, LIBRARY_SEARCH_MAX_LENGTH),
          page: toPageNumber(params.get(PAGE_QUERY_PARAM)),
          limit: toPageSize(params.get(LIMIT_QUERY_PARAM)),
        })),
        distinctUntilChanged(
          (a, b) => a.term === b.term && a.page === b.page && a.limit === b.limit,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((listParams) => this.applyListParams(listParams));

    this.searchInput
      .pipe(
        map((value) => value.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        takeUntilDestroyed(),
      )
      .subscribe((term) => this.updateUrl(term));
  }

  protected load(): void {
    this.state.set('loading');
    const limit = this.pageSize();
    // Drop the previous request so a slow, outdated search cannot overwrite newer results
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.librariesService
      .list({ skip: this.pageIndex() * limit, limit, search: this.search() })
      .subscribe({
        next: ({ items, total }) => {
          this.total.set(total);
          // Past the end, because the last library of the page was deleted or a shared link is
          // outdated: show the last page. Replacing the URL keeps the invalid one out of the
          // history, and the URL change reloads the list.
          const lastPage = Math.ceil(total / limit);
          if (total > 0 && this.pageIndex() + 1 > lastPage) {
            this.updatePageInUrl(lastPage, limit, true);
            return;
          }
          this.libraries.set(items);
          this.state.set('loaded');
        },
        error: () => this.state.set('error'),
      });
  }

  protected onSearchInput(value: string): void {
    this.query.set(value);
    this.searchInput.next(value);
  }

  protected clearSearch(): void {
    this.query.set('');
    // Replace any keystroke still waiting in the debounce, then clear the URL right away
    this.searchInput.next('');
    this.updateUrl('');
  }

  private updateUrl(term: string): void {
    // Typing a trailing space does not change the search, so it must not lose the current page
    if (term === this.search()) {
      return;
    }
    this.router.navigate([], {
      relativeTo: this.route,
      // A new search has different results: start again from the first page
      queryParams: { [SEARCH_QUERY_PARAM]: term || null, [PAGE_QUERY_PARAM]: null },
      queryParamsHandling: 'merge',
      // One history entry per page visit, not one per search typed
      replaceUrl: true,
    });
  }

  private updatePageInUrl(page: number, limit: number, replaceUrl = false): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        // Default values stay out of the URL to keep it short
        [PAGE_QUERY_PARAM]: page > 1 ? page : null,
        [LIMIT_QUERY_PARAM]: limit !== DEFAULT_PAGE_SIZE ? limit : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  private applyListParams(params: { term: string; page: number; limit: number }): void {
    // Only overwrite the field when the change comes from outside (reload, link, back/forward),
    // so a trailing space being typed is not removed
    if (this.query().trim() !== params.term) {
      this.query.set(params.term);
    }
    this.search.set(params.term);
    this.pageIndex.set(params.page - 1);
    this.pageSize.set(params.limit);
    this.load();
  }

  protected changePage(event: PageEvent): void {
    this.updatePageInUrl(event.pageIndex + 1, event.pageSize);
  }

  protected openCreateDialog(): void {
    this.dialog
      .open<LibraryFormDialog, LibraryFormDialogData, Library>(LibraryFormDialog, DIALOG_SIZE)
      .afterClosed()
      .subscribe((library) => {
        if (library) {
          this.notify(`Biblioteca «${library.name}» creada`);
          // On the first page the URL does not change, so nothing else would reload the list
          if (this.pageIndex() === 0) {
            this.load();
          } else {
            this.updatePageInUrl(1, this.pageSize());
          }
        }
      });
  }

  protected openEditDialog(library: Library): void {
    this.dialog
      .open<LibraryFormDialog, LibraryFormDialogData, Library>(LibraryFormDialog, {
        ...DIALOG_SIZE,
        data: { library },
      })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.libraries.update((list) =>
            list.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.notify('Cambios guardados');
        }
      });
  }

  protected openDeleteDialog(library: Library): void {
    this.dialog
      .open<DeleteLibraryDialog, Library, boolean>(DeleteLibraryDialog, {
        ...DIALOG_SIZE,
        data: library,
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.notify(`Biblioteca «${library.name}» eliminada`);
          this.load();
        }
      });
  }

  protected export(library: Library, format: LibraryExportFormat): void {
    this.exportingId.set(library.id);
    this.librariesService.export(library, format).subscribe({
      next: ({ blob, filename }) => {
        this.exportingId.set(null);
        saveFile(blob, filename);
      },
      error: () => {
        this.exportingId.set(null);
        this.notify('No se ha podido descargar la biblioteca. Inténtalo de nuevo.');
      },
    });
  }

  private notify(message: string): void {
    this.snackBar.open(message, undefined, { duration: 4000 });
  }
}
