import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { ApiError } from '../../../core/http/api-error';
import { ListedBook } from '../../user-books/user-book.model';
import { LibrariesService } from '../libraries.service';
import { AddBookToLibrary, Library } from '../library.model';

type LoadState = 'loading' | 'loaded' | 'error';

/** The maximum page size of the API. */
const MAX_LIBRARIES = 100;

export const ADD_TO_LIBRARIES_DIALOG_SIZE = { width: '440px', maxWidth: 'calc(100vw - 32px)' };

/** The book to add, from anywhere in the app. Without the cover: the catalog already has it. */
export type BookToAdd = Omit<AddBookToLibrary, 'cover'>;

/** The book of a card or a row, be it of the user or of a shared library. */
export function toBookToAdd(book: ListedBook): BookToAdd {
  return {
    title: book.bookTitle,
    isbn13: book.bookIsbn13,
    isbn10: book.bookIsbn10,
    authors: [...book.bookAuthors],
  };
}

/**
 * Adds a book that is already in the catalog to one of the libraries of the user. Closes with the
 * name of the library once it is added.
 */
@Component({
  selector: 'app-add-to-libraries-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './add-to-libraries-dialog.html',
  styleUrl: './add-to-libraries-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddToLibrariesDialog {
  private readonly librariesService = inject(LibrariesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject<MatDialogRef<AddToLibrariesDialog, string>>(MatDialogRef);
  protected readonly book = inject<BookToAdd>(MAT_DIALOG_DATA);

  protected readonly state = signal<LoadState>('loading');
  protected readonly libraries = signal<Library[]>([]);
  protected readonly adding = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    libraryId: ['', Validators.required],
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.librariesService
      .list({ skip: 0, limit: MAX_LIBRARIES })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items }) => {
          this.libraries.set(items);
          // With a single library there is nothing to choose
          if (items.length === 1) {
            this.form.setValue({ libraryId: items[0].id });
          }
          this.state.set('loaded');
        },
        error: () => this.state.set('error'),
      });
  }

  protected submit(): void {
    if (this.adding()) {
      return;
    }
    const library = this.libraries().find(({ id }) => id === this.form.controls.libraryId.value);
    if (!library) {
      this.form.markAllAsTouched();
      return;
    }
    this.adding.set(true);
    this.errorMessage.set(null);
    this.librariesService
      .addBook(library.id, this.book)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.dialogRef.close(library.name),
        error: (error: unknown) => {
          this.adding.set(false);
          this.errorMessage.set(
            error instanceof ApiError && error.statusCode === 409
              ? 'Este libro ya está en esa biblioteca.'
              : 'No se ha podido añadir el libro. Inténtalo de nuevo.',
          );
        },
      });
  }
}
