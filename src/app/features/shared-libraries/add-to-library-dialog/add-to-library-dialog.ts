import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { ApiError } from '../../../core/http/api-error';
import { LibrariesService } from '../../libraries/libraries.service';
import { Library } from '../../libraries/library.model';
import { SharedLibraryBook } from '../shared-library.model';

type LoadState = 'loading' | 'loaded' | 'error';

/** The maximum page size of the API. */
const MAX_LIBRARIES = 100;

export const ADD_TO_LIBRARY_DIALOG_SIZE = { width: '440px', maxWidth: 'calc(100vw - 32px)' };

/**
 * Adds a book of a shared library to one of the libraries of the user. Closes with the name of the
 * library once it is added.
 */
@Component({
  selector: 'app-add-to-library-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './add-to-library-dialog.html',
  styleUrl: './add-to-library-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddToLibraryDialog {
  private readonly librariesService = inject(LibrariesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject<MatDialogRef<AddToLibraryDialog, string>>(MatDialogRef);
  protected readonly book = inject<SharedLibraryBook>(MAT_DIALOG_DATA);

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
    const { bookTitle, bookIsbn13, bookIsbn10, bookAuthors } = this.book;
    this.librariesService
      // Without the cover: the book is already in the catalog, which has it
      .addBook(library.id, {
        title: bookTitle,
        isbn13: bookIsbn13,
        isbn10: bookIsbn10,
        authors: bookAuthors,
      })
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
