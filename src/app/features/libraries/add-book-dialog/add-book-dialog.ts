import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { ExternalBook } from '../../books/external-book.model';
import { ExternalBooksService } from '../../books/external-books.service';
import { LibrariesService } from '../libraries.service';
import { AddBookToLibrary } from '../library.model';

export interface AddBookDialogData {
  libraryId: string;
}

type IsbnLookup = { kind: 'found'; book: ExternalBook } | { kind: 'not-found'; isbn: string };

/** Rejects texts made only of spaces, which `Validators.required` accepts. */
const NOT_BLANK = [Validators.required, Validators.pattern(/\S/)];

/**
 * Finds a book by ISBN and adds it to a library; a book nobody knows can be added by typing its
 * data. Closes with the title of the added book, or with nothing when cancelled.
 */
@Component({
  selector: 'app-add-book-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './add-book-dialog.html',
  styleUrl: './add-book-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddBookDialog {
  private readonly externalBooks = inject(ExternalBooksService);
  private readonly libraries = inject(LibrariesService);
  private readonly dialogRef = inject<MatDialogRef<AddBookDialog, string>>(MatDialogRef);
  private readonly data = inject<AddBookDialogData>(MAT_DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    isbn: ['', NOT_BLANK],
    // Only used when the ISBN is not found
    title: ['', NOT_BLANK],
    authors: ['', NOT_BLANK],
  });

  protected readonly lookup = signal<IsbnLookup | null>(null);
  protected readonly searching = signal(false);
  protected readonly adding = signal(false);
  protected readonly coverFailed = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly foundBook = computed(() => {
    const lookup = this.lookup();
    return lookup?.kind === 'found' ? lookup.book : null;
  });
  protected readonly notFoundIsbn = computed(() => {
    const lookup = this.lookup();
    return lookup?.kind === 'not-found' ? lookup.isbn : null;
  });

  private searchSubscription?: Subscription;

  constructor() {
    // A result only applies to the ISBN it was found with: never add a book for an outdated search
    this.form.controls.isbn.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.resetSearch());
  }

  protected search(): void {
    const isbnControl = this.form.controls.isbn;
    if (isbnControl.invalid) {
      isbnControl.markAsTouched();
      return;
    }

    this.resetSearch();
    this.searching.set(true);
    const isbn = isbnControl.value.trim();
    this.searchSubscription = this.externalBooks
      .findByIsbn(isbn)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (book) => {
          this.searching.set(false);
          this.lookup.set({ kind: 'found', book });
        },
        error: (error: unknown) => {
          this.searching.set(false);
          const statusCode = error instanceof ApiError ? error.statusCode : null;
          if (statusCode === 404) {
            this.form.controls.title.reset();
            this.form.controls.authors.reset();
            this.lookup.set({ kind: 'not-found', isbn });
          } else {
            this.errorMessage.set(
              statusCode === 400
                ? 'Ese ISBN no es válido. Revísalo e inténtalo de nuevo.'
                : 'No se ha podido buscar el libro. Inténtalo de nuevo.',
            );
          }
        },
      });
  }

  protected add(): void {
    const book = this.bookToAdd();
    if (!book || this.adding()) {
      return;
    }

    this.adding.set(true);
    this.errorMessage.set(null);
    this.libraries
      .addBook(this.data.libraryId, book)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.dialogRef.close(book.title),
        error: (error: unknown) => {
          this.adding.set(false);
          this.errorMessage.set(
            error instanceof ApiError && error.statusCode === 409
              ? 'Este libro ya está en esta biblioteca.'
              : 'No se ha podido añadir el libro. Inténtalo de nuevo.',
          );
        },
      });
  }

  /** The book to send to the backend, or null while the typed data is not valid. */
  private bookToAdd(): AddBookToLibrary | null {
    const found = this.foundBook();
    if (found) {
      const { title, isbn13, isbn10, authors, cover } = found;
      return { title, isbn13, isbn10, authors, cover };
    }

    const isbn = this.notFoundIsbn();
    const { title, authors } = this.form.controls;
    if (isbn === null || title.invalid || authors.invalid) {
      title.markAsTouched();
      authors.markAsTouched();
      return null;
    }

    // The backend has already validated this ISBN: otherwise the search would have failed with 400
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    return {
      title: title.value.trim(),
      isbn13: cleanIsbn.length === 13 ? cleanIsbn : null,
      isbn10: cleanIsbn.length === 13 ? null : cleanIsbn,
      authors: authors.value
        .split(',')
        .map((author) => author.trim())
        .filter(Boolean),
    };
  }

  private resetSearch(): void {
    this.searchSubscription?.unsubscribe();
    this.searching.set(false);
    this.lookup.set(null);
    this.coverFailed.set(false);
    this.errorMessage.set(null);
  }
}
