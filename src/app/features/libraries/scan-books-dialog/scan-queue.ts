import { computed, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { ExternalBook } from '../../books/external-book.model';
import { AddBookToLibrary, toAddBookToLibrary } from '../library.model';

export type CurrentScan =
  | { status: 'searching'; isbn: string }
  | { status: 'review'; isbn: string; book: ExternalBook }
  | { status: 'adding'; isbn: string; book: ExternalBook };

export interface PendingScan {
  isbn: string;
  /** `not-found` is completed by typing the book's data; `error` can be retried. */
  reason: 'not-found' | 'error';
}

export interface ScanQueueBackend {
  findByIsbn(isbn: string): Observable<ExternalBook>;
  addBook(libraryId: string, book: AddBookToLibrary): Observable<unknown>;
}

/**
 * Processes scanned ISBNs one at a time: finds the book and waits until the user confirms or
 * discards it. Scanning faster than that loses nothing, because the ISBNs wait in line.
 */
export class ScanQueue {
  private readonly waiting = signal<string[]>([]);
  private readonly currentScan = signal<CurrentScan | null>(null);
  private readonly addedTitles = signal<string[]>([]);
  private readonly pendingScans = signal<PendingScan[]>([]);
  private readonly lastNotice = signal<string | null>(null);

  readonly current = this.currentScan.asReadonly();
  /** Titles of the books added during this session. */
  readonly added = this.addedTitles.asReadonly();
  /** Scanned books that could not be added and still need something from the user. */
  readonly pending = this.pendingScans.asReadonly();
  /** Result of the last finished book. */
  readonly notice = this.lastNotice.asReadonly();
  readonly waitingCount = computed(() => this.waiting().length);
  /** Books the user has not decided on: they would be lost by leaving. */
  readonly undecidedCount = computed(() => this.waiting().length + (this.currentScan() ? 1 : 0));

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly libraryId: string,
    private readonly backend: ScanQueueBackend,
  ) {}

  enqueue(isbn: string): void {
    this.waiting.update((list) => [...list, isbn]);
    this.processNext();
  }

  /** Adds the book under review to the library. */
  confirm(): void {
    const current = this.currentScan();
    if (current?.status !== 'review') {
      return;
    }

    const { isbn, book } = current;
    this.currentScan.set({ status: 'adding', isbn, book });
    this.subscriptions.add(
      this.backend.addBook(this.libraryId, toAddBookToLibrary(book)).subscribe({
        next: () => {
          this.addedTitles.update((titles) => [...titles, book.title]);
          this.finish(`«${book.title}» añadido a la biblioteca`);
        },
        error: (error: unknown) => {
          if (error instanceof ApiError && error.statusCode === 409) {
            this.finish(`«${book.title}» ya está en esta biblioteca`);
          } else {
            this.moveToPending(isbn, 'error');
          }
        },
      }),
    );
  }

  /**
   * Skips the book under review. Its ISBN stays ignored for the rest of the session: the book is
   * probably still in front of the camera and would otherwise come back straight away.
   */
  discard(): void {
    const current = this.currentScan();
    if (current?.status === 'review') {
      this.finish(`«${current.book.title}» descartado`);
    }
  }

  /** Looks for a pending book again. */
  retry(isbn: string): void {
    this.pendingScans.update((list) => list.filter((pending) => pending.isbn !== isbn));
    this.enqueue(isbn);
  }

  /** Records a book the user added by hand, which may resolve a pending one. */
  addedManually(title: string, isbn?: string): void {
    this.pendingScans.update((list) => list.filter((pending) => pending.isbn !== isbn));
    this.addedTitles.update((titles) => [...titles, title]);
    this.lastNotice.set(`«${title}» añadido a la biblioteca`);
  }

  destroy(): void {
    this.subscriptions.unsubscribe();
    this.waiting.set([]);
  }

  private processNext(): void {
    const [isbn, ...rest] = this.waiting();
    if (this.currentScan() || isbn === undefined) {
      return;
    }

    this.waiting.set(rest);
    this.currentScan.set({ status: 'searching', isbn });
    this.subscriptions.add(
      this.backend.findByIsbn(isbn).subscribe({
        next: (book) => this.currentScan.set({ status: 'review', isbn, book }),
        error: (error: unknown) => {
          const notFound = error instanceof ApiError && error.statusCode === 404;
          this.moveToPending(isbn, notFound ? 'not-found' : 'error');
        },
      }),
    );
  }

  private moveToPending(isbn: string, reason: PendingScan['reason']): void {
    this.pendingScans.update((list) => [...list, { isbn, reason }]);
    this.finish(
      reason === 'not-found'
        ? `No hemos encontrado el ISBN ${isbn}. Queda en pendientes.`
        : `No se ha podido procesar el ISBN ${isbn}. Queda en pendientes.`,
    );
  }

  private finish(notice: string): void {
    this.lastNotice.set(notice);
    this.currentScan.set(null);
    this.processNext();
  }
}
