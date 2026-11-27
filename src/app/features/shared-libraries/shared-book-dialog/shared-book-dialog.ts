import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { RatingValue } from '../../user-books/rating-value/rating-value';
import {
  ADD_TO_LIBRARIES_DIALOG_SIZE,
  AddToLibrariesDialog,
  AddedLibrary,
  BookToAdd,
  toBookToAdd,
} from '../../libraries/add-to-libraries-dialog/add-to-libraries-dialog';
import { SharedLibrary, SharedLibraryBook, personRatings } from '../shared-library.model';

export interface SharedBookDialogData {
  library: SharedLibrary;
  book: SharedLibraryBook;
}

/** The libraries of the user the book was added to, or nothing if it was not added. */
export interface SharedBookDialogResult {
  addedTo: AddedLibrary[];
}

export const SHARED_BOOK_DIALOG_SIZE = { width: '440px', maxWidth: 'calc(100vw - 32px)' };

/**
 * Shows a book of a shared library. Nothing is edited here: the opinion of the user is edited in
 * «Mis libros», and a book they do not have can be added to one of their own libraries.
 */
@Component({
  selector: 'app-shared-book-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, RatingValue, RouterLink],
  templateUrl: './shared-book-dialog.html',
  styleUrl: './shared-book-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedBookDialog {
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef =
    inject<MatDialogRef<SharedBookDialog, SharedBookDialogResult>>(MatDialogRef);
  private readonly data = inject<SharedBookDialogData>(MAT_DIALOG_DATA);

  protected readonly book = this.data.book;
  protected readonly authors = this.book.bookAuthors.join(', ') || 'Autor desconocido';
  /** The user cannot rate a book they do not have, so there is nothing to show as missing. */
  protected readonly ratings = personRatings(this.data.library, this.book).filter(
    (rating) => !rating.own || this.book.own !== null,
  );

  /** Covers come from external services, so a URL may stop working: show the placeholder then. */
  protected readonly coverFailed = signal(false);

  /** Following the link leaves the dialog behind. */
  protected close(): void {
    this.dialogRef.close();
  }

  protected openAddDialog(): void {
    this.dialog
      .open<AddToLibrariesDialog, BookToAdd, AddedLibrary[]>(AddToLibrariesDialog, {
        ...ADD_TO_LIBRARIES_DIALOG_SIZE,
        data: toBookToAdd(this.book),
      })
      .afterClosed()
      .subscribe((libraries) => {
        if (libraries) {
          this.dialogRef.close({ addedTo: libraries });
        }
      });
  }
}
