import { Injectable, signal } from '@angular/core';

/** How a list of books is shown: cards in a grid, or rows in a table. */
export type BooksView = 'grid' | 'table';

const STORAGE_KEY = 'bibliopolis.booksView';

/**
 * The view the user prefers for the lists of books («Mis libros» and the books of a library). It is
 * remembered in this browser only: it is a display preference, not data of the user.
 */
@Injectable({ providedIn: 'root' })
export class BooksViewPreference {
  private readonly current = signal<BooksView>(readStoredView());
  readonly view = this.current.asReadonly();

  set(view: BooksView): void {
    this.current.set(view);
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      // Storage may be blocked (private mode, browser settings): the choice lasts for this visit
    }
  }
}

function readStoredView(): BooksView {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
}
