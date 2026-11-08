import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, Subscription, map, of, switchMap } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { BookPreview } from '../../../books/book-preview/book-preview';
import { ExternalBook } from '../../../books/external-book.model';
import { ExternalBooksService } from '../../../books/external-books.service';
import { isValidIsbn10, isValidIsbn13, sanitizeIsbn } from '../../../books/isbn';
import { CatalogBook, CreateCatalogBook } from '../catalog-book.model';
import { CatalogBooksService } from '../catalog-books.service';
import { ISBN_SCAN_DIALOG_SIZE, IsbnScanDialog } from '../isbn-scan-dialog/isbn-scan-dialog';

/** Closes with the created book, with a book of the catalog to edit, or with nothing. */
export type NewBookDialogResult =
  { kind: 'created'; book: CatalogBook } | { kind: 'edit'; book: CatalogBook };

type Step =
  | { kind: 'isbn' }
  | { kind: 'in-catalog'; book: CatalogBook }
  | { kind: 'preview'; isbn: string; book: ExternalBook }
  | { kind: 'manual' };

type Lookup = { kind: 'in-catalog'; book: CatalogBook } | { kind: 'sources'; book: ExternalBook };

const NOT_BLANK = [Validators.required, Validators.pattern(/\S/)];

function isbnValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = sanitizeIsbn(control.value);
  return value === '' || isValidIsbn10(value) || isValidIsbn13(value) ? null : { isbn: true };
}

/**
 * Adds a book to the catalog: the admin scans or types the ISBN, and the book is taken from the
 * sources; if no source has it, the admin types its title and authors. A book already in the catalog
 * is not added again: the dialog offers editing it.
 */
@Component({
  selector: 'app-new-book-dialog',
  imports: [
    BookPreview,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './new-book-dialog.html',
  styleUrl: './new-book-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewBookDialog {
  private readonly catalog = inject(CatalogBooksService);
  private readonly externalBooks = inject(ExternalBooksService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef =
    inject<MatDialogRef<NewBookDialog, NewBookDialogResult>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    isbn: ['', [Validators.required, isbnValidator]],
    // Only used in the manual entry
    title: ['', NOT_BLANK],
    authors: ['', NOT_BLANK],
  });

  protected readonly step = signal<Step>({ kind: 'isbn' });
  protected readonly searching = signal(false);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** Shown above the manual form when it comes from a search without results. */
  protected readonly notFoundInSources = signal(false);

  protected readonly catalogBook = computed(() => {
    const step = this.step();
    return step.kind === 'in-catalog' ? step.book : null;
  });
  protected readonly previewBook = computed(() => {
    const step = this.step();
    return step.kind === 'preview' ? step.book : null;
  });
  protected readonly manual = computed(() => this.step().kind === 'manual');

  private searchSubscription?: Subscription;

  constructor() {
    // A result only applies to the ISBN it was found with
    this.form.controls.isbn.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.step().kind !== 'manual') {
        this.resetSearch();
      }
    });
  }

  /** Enter searches while looking up the ISBN; in the manual entry it submits the form. */
  protected onIsbnEnter(event: Event): void {
    if (!this.manual()) {
      event.preventDefault();
      this.search();
    }
  }

  protected openScanner(): void {
    this.dialog
      .open<IsbnScanDialog, void, string>(IsbnScanDialog, ISBN_SCAN_DIALOG_SIZE)
      .afterClosed()
      .subscribe((isbn) => {
        if (isbn) {
          this.step.set({ kind: 'isbn' });
          this.form.controls.isbn.setValue(isbn);
          this.search();
        }
      });
  }

  protected search(): void {
    const isbnControl = this.form.controls.isbn;
    if (isbnControl.invalid) {
      isbnControl.markAsTouched();
      return;
    }

    this.resetSearch();
    this.searching.set(true);
    const isbn = sanitizeIsbn(isbnControl.value);
    this.searchSubscription = this.lookUp(isbn)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lookup) => {
          this.searching.set(false);
          this.step.set(
            lookup.kind === 'in-catalog'
              ? { kind: 'in-catalog', book: lookup.book }
              : { kind: 'preview', isbn, book: lookup.book },
          );
        },
        error: (error: unknown) => {
          this.searching.set(false);
          const statusCode = error instanceof ApiError ? error.statusCode : null;
          if (statusCode === 404) {
            this.openManualEntry(true);
          } else {
            this.errorMessage.set(
              statusCode === 503
                ? 'Las fuentes de libros no responden ahora. Inténtalo más tarde o da de alta el libro a mano.'
                : 'No se ha podido buscar el libro. Inténtalo de nuevo.',
            );
          }
        },
      });
  }

  /** The manual entry, either after a search without results or straight away. */
  protected openManualEntry(notFound = false): void {
    this.searchSubscription?.unsubscribe();
    this.searching.set(false);
    this.errorMessage.set(null);
    this.notFoundInSources.set(notFound);
    this.form.controls.title.reset();
    this.form.controls.authors.reset();
    this.step.set({ kind: 'manual' });
  }

  protected backToSearch(): void {
    this.errorMessage.set(null);
    this.step.set({ kind: 'isbn' });
  }

  protected editExisting(book: CatalogBook): void {
    this.dialogRef.close({ kind: 'edit', book });
  }

  protected save(): void {
    const book = this.bookToCreate();
    if (!book || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.catalog
      .create(book)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => this.dialogRef.close({ kind: 'created', book: created }),
        error: (error: unknown) => {
          this.saving.set(false);
          const statusCode = error instanceof ApiError ? error.statusCode : null;
          if (statusCode === 404 && book.mode === 'sources') {
            // The sources stopped knowing the book since the search
            this.openManualEntry(true);
            return;
          }
          this.errorMessage.set(
            statusCode === 409
              ? 'Este libro ya está en el catálogo.'
              : statusCode === 503
                ? 'Las fuentes de libros no responden ahora. Inténtalo más tarde.'
                : 'No se ha podido dar de alta el libro. Inténtalo de nuevo.',
          );
        },
      });
  }

  /** First the catalog, to offer editing a book that already exists; then the sources. */
  private lookUp(isbn: string): Observable<Lookup> {
    return this.catalog
      .findByIsbn(isbn)
      .pipe(
        switchMap((book) =>
          book
            ? of<Lookup>({ kind: 'in-catalog', book })
            : this.externalBooks
                .findByIsbn(isbn)
                .pipe(map((found): Lookup => ({ kind: 'sources', book: found }))),
        ),
      );
  }

  private bookToCreate(): CreateCatalogBook | null {
    const step = this.step();
    if (step.kind === 'preview') {
      return { mode: 'sources', isbn: step.isbn };
    }
    if (step.kind !== 'manual') {
      return null;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return null;
    }
    const { isbn, title, authors } = this.form.getRawValue();
    return {
      mode: 'manual',
      isbn: sanitizeIsbn(isbn),
      title: title.trim(),
      authors: authors
        .split(',')
        .map((author) => author.trim())
        .filter(Boolean),
    };
  }

  private resetSearch(): void {
    this.searchSubscription?.unsubscribe();
    this.searching.set(false);
    this.errorMessage.set(null);
    this.step.set({ kind: 'isbn' });
  }
}
