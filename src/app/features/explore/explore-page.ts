import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { CatalogBook } from '../backoffice/books/catalog-book.model';
import { CatalogBooksService } from '../backoffice/books/catalog-books.service';
import { BookShelf } from './book-shelf/book-shelf';
import {
  CATALOG_BOOK_DIALOG_SIZE,
  CatalogBookDialog,
} from './catalog-book-dialog/catalog-book-dialog';

/** How many of the newest books the shelf shows. */
export const LATEST_BOOKS_LIMIT = 20;

type State = 'loading' | 'error' | 'loaded';

/** The newest books of the catalog with a cover, which the backend lists newest first. */
@Component({
  selector: 'app-explore-page',
  imports: [MatButtonModule, MatIconModule, BookShelf],
  templateUrl: './explore-page.html',
  styleUrl: './explore-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorePage {
  private readonly catalogBooks = inject(CatalogBooksService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<State>('loading');
  protected readonly latest = signal<CatalogBook[]>([]);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.catalogBooks
      .list({ skip: 0, limit: LATEST_BOOKS_LIMIT, hasCover: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.latest.set(page.items);
          this.state.set('loaded');
        },
        error: () => this.state.set('error'),
      });
  }

  protected openBook(book: CatalogBook): void {
    this.dialog.open(CatalogBookDialog, { ...CATALOG_BOOK_DIALOG_SIZE, data: book });
  }
}
