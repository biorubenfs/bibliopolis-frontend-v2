import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { BookLibraries } from '../../user-books/book-libraries/book-libraries';
import { RatingInput } from '../../user-books/rating-input/rating-input';
import { ReadingStatusInput } from '../../user-books/reading-status-input/reading-status-input';
import { USER_BOOK_NOTES_MAX_LENGTH, UserBook } from '../../user-books/user-book.model';
import { UserBooksService } from '../../user-books/user-books.service';
import { RemoveBookDialog, RemoveBookDialogData } from '../remove-book-dialog/remove-book-dialog';

export interface BookDetailDialogData {
  /** The library the book is being viewed from. Without it the book cannot be removed. */
  libraryId?: string;
  book: UserBook;
}

/** The saved book, `'removed'` if it left the library, or nothing if no change was made. */
export type BookDetailDialogResult = UserBook | 'removed';

const REMOVE_DIALOG_SIZE = { width: '520px', maxWidth: 'calc(100vw - 32px)' };

/** The day of the user, as YYYY-MM-DD: the format of the date inputs and of the backend. */
export function localDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Nobody finishes a book in the future. YYYY-MM-DD texts sort as dates. */
function notAfterToday(control: AbstractControl<string>): ValidationErrors | null {
  return control.value && control.value > localDay() ? { future: true } : null;
}

/**
 * Shows a book, with the libraries that contain it, and lets the user edit its rating, notes and
 * reading status, which are only persisted when saving. When opened from a library, it also lets the user remove
 * the book from that library.
 */
@Component({
  selector: 'app-book-detail-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    BookLibraries,
    RatingInput,
    ReadingStatusInput,
  ],
  templateUrl: './book-detail-dialog.html',
  styleUrl: './book-detail-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookDetailDialog {
  private readonly dialog = inject(MatDialog);
  private readonly userBooks = inject(UserBooksService);
  private readonly dialogRef =
    inject<MatDialogRef<BookDetailDialog, BookDetailDialogResult>>(MatDialogRef);
  private readonly data = inject<BookDetailDialogData>(MAT_DIALOG_DATA);

  protected readonly book = this.data.book;
  protected readonly libraryId = this.data.libraryId;
  protected readonly authors = this.book.bookAuthors.join(', ') || 'Autor desconocido';

  protected readonly notesMaxLength = USER_BOOK_NOTES_MAX_LENGTH;

  /** The latest day a book can be finished, for the date input. */
  protected readonly today = localDay();

  protected readonly form = inject(NonNullableFormBuilder).group({
    rating: [this.book.rating],
    notes: [this.book.notes ?? '', Validators.maxLength(USER_BOOK_NOTES_MAX_LENGTH)],
    readingStatus: [this.book.readingStatus],
    // Empty for no date, as the date input gives it
    finishedAt: [this.book.finishedAt ?? '', notAfterToday],
  });

  /** Only a read book has a finish date: the field is only shown then. */
  protected readonly readingStatus = toSignal(this.form.controls.readingStatus.valueChanges, {
    initialValue: this.book.readingStatus,
  });

  constructor() {
    this.form.controls.readingStatus.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.updateFinishedAt(status));
  }

  /** Covers come from external services, so a URL may stop working: show the placeholder then. */
  protected readonly coverFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.form.pristine) {
      this.dialogRef.close();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.userBooks
      .update(this.book.id, {
        rating: this.form.controls.rating.value,
        // The backend expects null, not an empty text, for a book without notes
        notes: this.form.controls.notes.value.trim() || null,
        readingStatus: this.form.controls.readingStatus.value,
        finishedAt: this.finishedAtToSave(),
      })
      .subscribe({
        next: (book) => this.dialogRef.close(book),
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('No se han podido guardar los cambios. Inténtalo de nuevo.');
        },
      });
  }

  /**
   * Marking a book as read suggests today as its finish date. If it was already read when the
   * dialog opened, it gets back its date instead, so undoing a mistake before saving loses nothing.
   * Any other status has no finish date.
   */
  private updateFinishedAt(status: UserBook['readingStatus']): void {
    const finishedAt = this.form.controls.finishedAt;
    if (status !== 'read') {
      finishedAt.setValue('');
    } else if (this.book.readingStatus === 'read') {
      finishedAt.setValue(this.book.finishedAt ?? '');
    } else {
      finishedAt.setValue(this.today);
    }
  }

  /** Only a read book may have a finish date, and it may not: null then. */
  private finishedAtToSave(): string | null {
    if (this.form.controls.readingStatus.value !== 'read') {
      return null;
    }
    return this.form.controls.finishedAt.value || null;
  }

  /** Following a link to a library leaves the dialog behind, so it closes without changes. */
  protected closeOnNavigation(): void {
    this.dialogRef.close();
  }

  protected openRemoveDialog(libraryId: string): void {
    this.dialog
      .open<RemoveBookDialog, RemoveBookDialogData, boolean>(RemoveBookDialog, {
        ...REMOVE_DIALOG_SIZE,
        data: { libraryId, book: this.book },
      })
      .afterClosed()
      .subscribe((removed) => {
        if (removed) {
          this.dialogRef.close('removed');
        }
      });
  }
}
