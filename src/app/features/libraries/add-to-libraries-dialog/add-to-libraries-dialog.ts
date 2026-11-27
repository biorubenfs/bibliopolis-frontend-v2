import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, filter, forkJoin, map, of } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { ListedBook } from '../../user-books/user-book.model';
import { UserBooksService } from '../../user-books/user-books.service';
import { LibrariesService } from '../libraries.service';
import { AddBookToLibrary, Library } from '../library.model';

type LoadState = 'loading' | 'loaded' | 'error';

/** The maximum page size of the API. */
const MAX_LIBRARIES = 100;

export const ADD_TO_LIBRARIES_DIALOG_SIZE = { width: '440px', maxWidth: 'calc(100vw - 32px)' };

/** The book to add, from anywhere in the app. Without the cover: the catalog already has it. */
export type BookToAdd = Omit<AddBookToLibrary, 'cover'>;

/** A library the book was added to. */
export type AddedLibrary = Pick<Library, 'id' | 'name'>;

/** The book of a card or a row, be it of the user or of a shared library. */
export function toBookToAdd(book: ListedBook): BookToAdd {
  return {
    title: book.bookTitle,
    isbn13: book.bookIsbn13,
    isbn10: book.bookIsbn10,
    authors: [...book.bookAuthors],
  };
}

/** What to tell the user once the book was added. */
export function addedMessage(title: string, libraries: readonly AddedLibrary[]): string {
  return libraries.length === 1
    ? `«${title}» añadido a «${libraries[0].name}»`
    : `«${title}» añadido a ${libraries.length} bibliotecas`;
}

/**
 * Adds a book that is already in the catalog to one or more libraries of the user. The libraries
 * that already contain it are shown checked and disabled. Closes with the libraries the book was
 * added to, or with nothing if it was not added to any.
 */
@Component({
  selector: 'app-add-to-libraries-dialog',
  imports: [MatButtonModule, MatCheckboxModule, MatDialogModule, MatProgressSpinnerModule],
  templateUrl: './add-to-libraries-dialog.html',
  styleUrl: './add-to-libraries-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddToLibrariesDialog {
  private readonly librariesService = inject(LibrariesService);
  private readonly userBooks = inject(UserBooksService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef =
    inject<MatDialogRef<AddToLibrariesDialog, AddedLibrary[]>>(MatDialogRef);
  protected readonly book = inject<BookToAdd>(MAT_DIALOG_DATA);

  protected readonly state = signal<LoadState>('loading');
  protected readonly libraries = signal<Library[]>([]);
  /** IDs of the libraries that contain the book, before or since the dialog opened. */
  protected readonly containing = signal<ReadonlySet<string>>(new Set());
  /** IDs of the libraries chosen to add the book to. */
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly adding = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** The libraries the book was added to while the dialog was open. */
  private readonly added = signal<AddedLibrary[]>([]);

  protected readonly allContain = computed(() =>
    this.libraries().every(({ id }) => this.containing().has(id)),
  );

  constructor() {
    // Closing with Escape or the backdrop must not lose the libraries already added
    this.dialogRef.disableClose = true;
    this.dialogRef
      .backdropClick()
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.close());
    this.dialogRef
      .keydownEvents()
      .pipe(
        filter((event) => event.key === 'Escape'),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.close());
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    forkJoin({
      libraries: this.librariesService.list({ skip: 0, limit: MAX_LIBRARIES }),
      containing: this.containingLibraries(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ libraries, containing }) => {
          this.libraries.set(libraries.items);
          this.containing.set(containing);
          const available = libraries.items.filter(({ id }) => !containing.has(id));
          // With a single library left there is nothing to choose
          this.selected.set(new Set(available.length === 1 ? [available[0].id] : []));
          this.state.set('loaded');
        },
        error: () => this.state.set('error'),
      });
  }

  protected toggle(libraryId: string, checked: boolean): void {
    this.selected.update((ids) => {
      const next = new Set(ids);
      if (checked) {
        next.add(libraryId);
      } else {
        next.delete(libraryId);
      }
      return next;
    });
  }

  protected submit(event: Event): void {
    // A native form: without this the page would reload
    event.preventDefault();
    const chosen = this.libraries().filter(({ id }) => this.selected().has(id));
    if (this.adding() || chosen.length === 0) {
      return;
    }
    this.adding.set(true);
    this.errorMessage.set(null);
    forkJoin(
      chosen.map((library) =>
        this.librariesService.addBook(library.id, this.book).pipe(
          map(() => true),
          // Already there, maybe added from another tab: what the user wanted
          catchError((error: unknown) => of(error instanceof ApiError && error.statusCode === 409)),
          map((ok) => ({ library, ok })),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((results) => {
        const done = results.filter(({ ok }) => ok).map(({ library }) => library);
        const failed = results.filter(({ ok }) => !ok).map(({ library }) => library);
        this.added.update((list) => [...list, ...done.map(({ id, name }) => ({ id, name }))]);
        this.containing.update((ids) => new Set([...ids, ...done.map(({ id }) => id)]));
        // The failed ones stay checked, to try again
        this.selected.set(new Set(failed.map(({ id }) => id)));
        this.adding.set(false);
        if (failed.length === 0) {
          this.close();
        } else {
          const names = failed.map(({ name }) => `«${name}»`).join(', ');
          this.errorMessage.set(`No se ha podido añadir a ${names}. Inténtalo de nuevo.`);
        }
      });
  }

  protected close(): void {
    const added = this.added();
    this.dialogRef.close(added.length > 0 ? added : undefined);
  }

  /** The libraries of the user that contain the book, from their copy of it if they have one. */
  private containingLibraries() {
    const isbn = this.book.isbn13 ?? this.book.isbn10;
    if (!isbn) {
      return of(new Set<string>());
    }
    return this.userBooks.list({ skip: 0, limit: 5, search: isbn }).pipe(
      map(({ items }) => {
        // The search also matches titles and authors: keep the copy with this ISBN
        const copy = items.find(
          (item) => item.bookIsbn13 === this.book.isbn13 || item.bookIsbn10 === isbn,
        );
        return new Set(copy?.libraries ?? []);
      }),
    );
  }
}
