import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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

import { RatingInput } from '../../user-books/rating-input/rating-input';
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

/**
 * Shows a book and lets the user edit its rating and notes, which are only persisted when saving.
 * When opened from a library, it also lets the user remove the book from that library.
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
    RatingInput,
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

  protected readonly form = inject(NonNullableFormBuilder).group({
    rating: [this.book.rating],
    notes: [this.book.notes ?? '', Validators.maxLength(USER_BOOK_NOTES_MAX_LENGTH)],
  });

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
      })
      .subscribe({
        next: (book) => this.dialogRef.close(book),
        error: () => {
          this.saving.set(false);
          this.errorMessage.set('No se han podido guardar los cambios. Inténtalo de nuevo.');
        },
      });
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
