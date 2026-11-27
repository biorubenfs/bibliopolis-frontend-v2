import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

import { CatalogBook } from '../../backoffice/books/catalog-book.model';
import { ShelfCover } from '../book-shelf/shelf-cover';

export const CATALOG_BOOK_DIALOG_SIZE = { width: '440px', maxWidth: 'calc(100vw - 32px)' };

/** Read-only details of a book of the catalog. */
@Component({
  selector: 'app-catalog-book-dialog',
  imports: [MatButtonModule, MatDialogModule, ShelfCover],
  template: `
    <h2 mat-dialog-title>{{ book.title }}</h2>

    <mat-dialog-content>
      <div class="summary">
        <app-shelf-cover class="cover" [url]="book.coverUrl" [title]="book.title" />

        <div class="info">
          <p class="authors">{{ authors }}</p>
          <div class="isbn">
            <p>ISBN-13: {{ book.isbn13 }}</p>
            @if (book.isbn10; as isbn10) {
              <p>ISBN-10: {{ isbn10 }}</p>
            }
          </div>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    h2 {
      overflow-wrap: anywhere;
    }

    p {
      margin: 0;
      overflow-wrap: anywhere;
    }

    mat-dialog-content {
      padding-top: 8px;
    }

    .summary {
      display: flex;
      gap: 16px;
    }

    .cover {
      flex: none;
      align-self: flex-start;
      width: 112px;
      box-shadow: var(--app-card-shadow);
    }

    .info {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 8px;
      // Lets long words wrap instead of pushing the content wider than the dialog
      min-width: 0;
    }

    .authors {
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
    }

    .isbn {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogBookDialog {
  protected readonly book = inject<CatalogBook>(MAT_DIALOG_DATA);
  protected readonly authors = this.book.authors.join(', ') || 'Autor desconocido';
}
