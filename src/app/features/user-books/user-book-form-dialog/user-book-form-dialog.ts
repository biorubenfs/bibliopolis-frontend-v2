import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { USER_BOOK_NOTES_MAX_LENGTH, USER_BOOK_RATINGS, UserBook } from '../user-book.model';
import { UserBooksService } from '../user-books.service';

/** Edits the rating and notes of a book. Closes with the saved book, or nothing if unchanged. */
@Component({
  selector: 'app-user-book-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './user-book-form-dialog.html',
  styleUrl: './user-book-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserBookFormDialog {
  private readonly userBooks = inject(UserBooksService);
  private readonly dialogRef = inject<MatDialogRef<UserBookFormDialog, UserBook>>(MatDialogRef);
  protected readonly book = inject<UserBook>(MAT_DIALOG_DATA);

  protected readonly ratings = USER_BOOK_RATINGS;
  protected readonly notesMaxLength = USER_BOOK_NOTES_MAX_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group({
    rating: [this.book.rating],
    notes: [this.book.notes ?? '', Validators.maxLength(USER_BOOK_NOTES_MAX_LENGTH)],
  });

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
}
