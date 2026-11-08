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
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';

import { ApiError } from '../../../../core/http/api-error';
import {
  COVER_SOURCE_LABELS,
  CatalogBook,
  CoverCandidate,
  CoverSource,
  UpdateCatalogBook,
} from '../catalog-book.model';
import { CatalogBooksService } from '../catalog-books.service';

export interface EditBookDialogData {
  book: CatalogBook;
}

/** `current` keeps the cover as it is; `none` leaves the book without cover. */
export type CoverChoice = 'current' | 'none' | CoverSource;

/**
 * Corrects the title, the authors and the cover of a catalog book. The ISBNs cannot be changed. The
 * cover can only come from the sources, which are asked when the dialog opens. Closes with the
 * updated book, or with nothing.
 */
@Component({
  selector: 'app-edit-book-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
  ],
  templateUrl: './edit-book-dialog.html',
  styleUrl: './edit-book-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditBookDialog {
  private readonly catalog = inject(CatalogBooksService);
  private readonly dialogRef = inject<MatDialogRef<EditBookDialog, CatalogBook>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly book = inject<EditBookDialogData>(MAT_DIALOG_DATA).book;

  protected readonly sourceLabels = COVER_SOURCE_LABELS;

  protected readonly title = inject(NonNullableFormBuilder).control(this.book.title, [
    Validators.required,
    Validators.pattern(/\S/),
  ]);
  protected readonly authors = signal<string[]>([...this.book.authors]);

  protected readonly covers = signal<CoverCandidate[]>([]);
  protected readonly coversState = signal<'loading' | 'loaded' | 'error'>('loading');
  protected readonly coverChoice = signal<CoverChoice>(this.book.coverUrl ? 'current' : 'none');

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly hasCurrentCover = this.book.coverUrl !== null;

  /** What is sent to the backend: only what changed. */
  protected readonly changes = computed<UpdateCatalogBook>(() => {
    const changes: UpdateCatalogBook = {};
    const title = this.titleValue().trim();
    if (title !== this.book.title) {
      changes.title = title;
    }
    const authors = this.authors();
    if (authors.join('\n') !== this.book.authors.join('\n')) {
      changes.authors = authors;
    }
    const choice = this.coverChoice();
    if (choice === 'none') {
      if (this.hasCurrentCover) changes.coverSource = null;
    } else if (choice !== 'current') {
      changes.coverSource = choice;
    }
    return changes;
  });

  private readonly titleValue = signal(this.book.title);

  constructor() {
    this.title.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.titleValue.set(value));
    this.loadCovers();
  }

  protected loadCovers(): void {
    this.coversState.set('loading');
    this.catalog
      .listCovers(this.book.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (covers) => {
          this.covers.set(covers);
          this.coversState.set('loaded');
        },
        error: () => this.coversState.set('error'),
      });
  }

  protected addAuthor(event: MatChipInputEvent): void {
    const author = event.value.trim();
    if (author) {
      this.authors.update((list) => [...list, author]);
    }
    event.chipInput.clear();
  }

  protected removeAuthor(index: number): void {
    this.authors.update((list) => list.filter((_, i) => i !== index));
  }

  protected save(event: Event): void {
    // A native submit: there is no form group, the title is a standalone control
    event.preventDefault();
    if (this.title.invalid || this.saving()) {
      this.title.markAsTouched();
      return;
    }
    const changes = this.changes();
    if (Object.keys(changes).length === 0) {
      this.dialogRef.close();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.catalog
      .update(this.book.id, changes)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (book) => this.dialogRef.close(book),
        error: (error: unknown) => {
          this.saving.set(false);
          const statusCode = error instanceof ApiError ? error.statusCode : null;
          this.errorMessage.set(
            statusCode === 422
              ? 'Esa fuente ya no tiene portada para este libro. Elige otra opción.'
              : statusCode === 503
                ? 'La fuente de la portada no responde ahora. Inténtalo más tarde.'
                : 'No se han podido guardar los cambios. Inténtalo de nuevo.',
          );
        },
      });
  }
}
