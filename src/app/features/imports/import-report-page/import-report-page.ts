import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { Subscription, exhaustMap, takeWhile, timer } from 'rxjs';

import { saveFile } from '../../../core/files/save-file';
import { ApiError } from '../../../core/http/api-error';
import { SpanishPaginatorIntl } from '../../../core/i18n/paginator-intl';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../../core/pagination/pagination';
import { AddBookDialog, AddBookDialogData } from '../../libraries/add-book-dialog/add-book-dialog';
import {
  ImportItem,
  ImportItemOutcome,
  ImportItemResolution,
  LibraryImport,
  OUTCOME_LABELS,
  importErrorMessage,
  isActiveImport,
} from '../import.model';
import { ImportsService } from '../imports.service';
import { buildPendingCsv, pendingCsvFileName } from './pending-csv';

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error';
type ItemsFilter = 'pending' | 'all' | 'added' | 'already_in_library' | 'duplicate_in_file';

/** How often the progress of a running import is checked. */
export const IMPORT_POLL_INTERVAL_MS = 2000;

const ACTION_REQUIRED: readonly ImportItemOutcome[] = [
  'not_found',
  'invalid_isbn',
  'missing_isbn',
  'source_error',
  'internal_error',
];

const DIALOG_SIZE = { width: '520px', maxWidth: 'calc(100vw - 32px)' };

/** Shows the progress of an import and, when it finishes, its report with the rows to resolve. */
@Component({
  selector: 'app-import-report-page',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './import-report-page.html',
  styleUrl: './import-report-page.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportReportPage {
  private readonly imports = inject(ImportsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  private readonly progressHeading = viewChild<ElementRef<HTMLElement>>('progressHeading');
  private readonly reportHeading = viewChild<ElementRef<HTMLElement>>('reportHeading');
  private readonly listHeading = viewChild<ElementRef<HTMLElement>>('listHeading');

  /** Library ID, bound from the `:id` route param. */
  readonly id = input.required<string>();
  /** Import ID, bound from the `:importId` route param. */
  readonly importId = input.required<string>();

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly outcomeLabels = OUTCOME_LABELS;

  protected readonly job = signal<LibraryImport | null>(null);
  protected readonly state = signal<LoadState>('loading');

  protected readonly items = signal<ImportItem[]>([]);
  protected readonly itemsTotal = signal(0);
  protected readonly itemsState = signal<LoadState>('loading');
  protected readonly filter = signal<ItemsFilter>('pending');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  protected readonly busyItemId = signal<string | null>(null);
  protected readonly retrying = signal(false);
  protected readonly downloading = signal(false);

  protected readonly active = computed(() => {
    const job = this.job();
    return job !== null && isActiveImport(job);
  });
  protected readonly progress = computed(() => {
    const counts = this.job()?.counts;
    return counts && counts.total > 0 ? (counts.processed / counts.total) * 100 : 0;
  });
  /** Only milestones and the end are announced: a screen reader cannot keep up with every row. */
  protected readonly announcement = computed(() => {
    const job = this.job();
    if (!job) {
      return '';
    }
    if (job.status === 'completed') {
      return 'Importación terminada.';
    }
    if (job.status === 'failed') {
      return 'La importación se ha interrumpido.';
    }
    return `Importación en curso: ${Math.floor(this.progress() / 25) * 25} % procesado.`;
  });

  private pollSubscription?: Subscription;
  private itemsSubscription?: Subscription;

  constructor() {
    // The router reuses this component while the route stays the same
    effect(() => {
      this.importId();
      untracked(() => {
        this.job.set(null);
        this.follow();
      });
    });
  }

  /** Follows the import until it reaches a final state. Stops as well on leaving or on an error. */
  protected follow(): void {
    this.state.set('loading');
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = timer(0, IMPORT_POLL_INTERVAL_MS)
      .pipe(
        exhaustMap(() => this.imports.get(this.importId())),
        takeWhile((job) => isActiveImport(job), true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (job) => {
          const arriving = this.state() === 'loading';
          this.job.set(job);
          this.state.set('loaded');
          if (isActiveImport(job) && arriving) {
            this.focus(this.progressHeading);
          }
          if (!isActiveImport(job)) {
            this.filter.set(job.counts.pending > 0 || job.status === 'failed' ? 'pending' : 'all');
            this.pageIndex.set(0);
            this.loadItems();
            this.focus(this.reportHeading);
          }
        },
        error: (error: unknown) => {
          const notFound =
            error instanceof ApiError && (error.statusCode === 403 || error.statusCode === 404);
          this.state.set(notFound ? 'not-found' : 'error');
        },
      });
  }

  protected loadItems(): void {
    const limit = this.pageSize();
    const filter = this.filter();
    this.itemsState.set('loading');
    // Drop the previous request so a slow, outdated page cannot overwrite newer results
    this.itemsSubscription?.unsubscribe();
    this.itemsSubscription = this.imports
      .listItems(this.importId(), {
        skip: this.pageIndex() * limit,
        limit,
        pending: filter === 'pending' ? true : undefined,
        outcome: filter === 'pending' || filter === 'all' ? undefined : filter,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items, total }) => {
          this.itemsTotal.set(total);
          // Past the end, because the last row of the page has just been resolved
          const lastPage = Math.ceil(total / limit);
          if (total > 0 && this.pageIndex() + 1 > lastPage) {
            this.pageIndex.set(lastPage - 1);
            this.loadItems();
            return;
          }
          this.items.set(items);
          this.itemsState.set('loaded');
        },
        error: () => this.itemsState.set('error'),
      });
  }

  protected changeFilter(event: MatButtonToggleChange): void {
    this.filter.set(event.value as ItemsFilter);
    this.pageIndex.set(0);
    this.loadItems();
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadItems();
  }

  protected addManually(item: ImportItem): void {
    const job = this.job();
    if (!job) {
      return;
    }

    this.dialog
      .open<AddBookDialog, AddBookDialogData, string>(AddBookDialog, {
        ...DIALOG_SIZE,
        data: {
          libraryId: job.libraryId,
          isbn: item.isbn13 ?? item.rawIsbn ?? undefined,
        },
      })
      .afterClosed()
      .subscribe((title) => {
        if (title) {
          this.notify(`«${title}» añadido a la biblioteca`);
          this.resolve(item, 'manual');
        }
      });
  }

  protected dismiss(item: ImportItem): void {
    this.resolve(item, 'dismissed', () => {
      this.snackBar
        .open(`Fila ${item.row} descartada`, 'Deshacer', { duration: 6000 })
        .onAction()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.undoDismiss(item));
    });
  }

  protected undoDismiss(item: ImportItem): void {
    this.resolve(item, null);
  }

  protected retry(): void {
    if (this.retrying()) {
      return;
    }

    this.retrying.set(true);
    this.imports
      .retry(this.importId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (job) => {
          this.retrying.set(false);
          this.job.set(job);
          this.items.set([]);
          this.follow();
        },
        error: (error: unknown) => {
          this.retrying.set(false);
          this.notify(importErrorMessage(error));
        },
      });
  }

  protected downloadPending(): void {
    const job = this.job();
    if (!job || this.downloading()) {
      return;
    }

    this.downloading.set(true);
    this.imports
      .listAllPending(job.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.downloading.set(false);
          saveFile(buildPendingCsv(items), pendingCsvFileName(job.fileName));
        },
        error: () => {
          this.downloading.set(false);
          this.notify('No se han podido descargar los pendientes. Inténtalo de nuevo.');
        },
      });
  }

  /** A row that needed action and stopped being pending because its book reached the library. */
  protected reachedLibraryAnotherWay(item: ImportItem): boolean {
    return !item.pending && item.resolution === null && ACTION_REQUIRED.includes(item.outcome);
  }

  /** The name that tells apart the buttons of each row for screen readers. */
  protected itemName(item: ImportItem): string {
    return item.rawIsbn ?? `fila ${item.row}`;
  }

  private resolve(
    item: ImportItem,
    resolution: ImportItemResolution | null,
    onSuccess?: () => void,
  ): void {
    this.busyItemId.set(item.id);
    this.imports
      .updateItem(this.importId(), item.id, resolution)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyItemId.set(null);
          onSuccess?.();
          this.refreshReport();
          // The button that was pressed may be gone with its row: keep the keyboard focus nearby
          this.focus(this.listHeading);
        },
        error: () => {
          this.busyItemId.set(null);
          this.notify('No se ha podido actualizar la fila. Inténtalo de nuevo.');
          this.refreshReport();
        },
      });
  }

  /** Updates the summary and the list once. Following again is only needed while it is active. */
  private refreshReport(): void {
    this.loadItems();
    this.imports
      .get(this.importId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (job) => this.job.set(job),
        // The list above already shows what matters; the summary catches up on the next change
        error: () => undefined,
      });
  }

  private focus(target: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }

  private notify(message: string): void {
    this.snackBar.open(message, undefined, { duration: 4000 });
  }
}
