import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/http/api-error';
import {
  ADD_TO_LIBRARY_DIALOG_SIZE,
  AddToLibraryDialog,
  AddToLibraryDialogData,
} from '../../shared-libraries/add-to-library-dialog/add-to-library-dialog';
import { RatingValue } from '../../user-books/rating-value/rating-value';
import { SharedBook, SharedBookDetail } from '../shared-book.model';
import { SharedBooksService } from '../shared-books.service';

type State = 'loading' | 'loaded' | 'error' | 'notFound';

/** The library of the user the book was added to, or nothing if it was not added. */
export interface SharedBookDetailDialogResult {
  addedTo: string;
}

export const SHARED_BOOK_DETAIL_DIALOG_SIZE = { width: '480px', maxWidth: 'calc(100vw - 32px)' };

/** People shown before the rest are folded behind «+N más», to keep the dialog short. */
const VISIBLE_PEOPLE = 5;

/**
 * Shows a book of the shared libraries with everyone who shares it and the ratings they show. As in
 * the one of a single library, nothing is edited here.
 */
@Component({
  selector: 'app-shared-book-detail-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RatingValue,
    RouterLink,
  ],
  templateUrl: './shared-book-detail-dialog.html',
  styleUrls: [
    '../../shared-libraries/shared-book-dialog/shared-book-dialog.scss',
    './shared-book-detail-dialog.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedBookDetailDialog {
  private readonly sharedBooks = inject(SharedBooksService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef =
    inject<MatDialogRef<SharedBookDetailDialog, SharedBookDetailDialogResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);

  /** From the list: shown at once, while the people are loaded. */
  protected readonly book = inject<SharedBook>(MAT_DIALOG_DATA);
  protected readonly authors = this.book.bookAuthors.join(', ') || 'Autor desconocido';

  /** The book is not in any library shared with the user any more. */
  readonly notFound = output<void>();

  protected readonly state = signal<State>('loading');
  protected readonly detail = signal<SharedBookDetail | null>(null);
  /** Up to date once loaded: the user may have added the book meanwhile, e.g. in another window. */
  protected readonly own = computed(() => {
    const detail = this.detail();
    return detail ? detail.own : this.book.own;
  });

  protected readonly expanded = signal(false);
  protected readonly people = computed(() => {
    const people = this.detail()?.people ?? [];
    return this.expanded() ? people : people.slice(0, VISIBLE_PEOPLE);
  });
  protected readonly hiddenCount = computed(() =>
    Math.max((this.detail()?.people.length ?? 0) - VISIBLE_PEOPLE, 0),
  );

  /** Covers come from external services, so a URL may stop working: show the placeholder then. */
  protected readonly coverFailed = signal(false);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.sharedBooks
      .get(this.book.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.state.set('loaded');
        },
        error: (error: unknown) => {
          if (error instanceof ApiError && error.statusCode === 404) {
            this.state.set('notFound');
            this.notFound.emit();
          } else {
            this.state.set('error');
          }
        },
      });
  }

  protected toggleExpanded(): void {
    this.expanded.update((expanded) => !expanded);
  }

  /** Following a link leaves the dialog behind. */
  protected close(): void {
    this.dialogRef.close();
  }

  protected openAddDialog(): void {
    this.dialog
      .open<AddToLibraryDialog, AddToLibraryDialogData, string>(AddToLibraryDialog, {
        ...ADD_TO_LIBRARY_DIALOG_SIZE,
        data: this.book,
      })
      .afterClosed()
      .subscribe((libraryName) => {
        if (libraryName) {
          this.dialogRef.close({ addedTo: libraryName });
        }
      });
  }
}
