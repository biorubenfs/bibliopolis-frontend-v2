import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CatalogBook } from '../../backoffice/books/catalog-book.model';
import {
  ADD_TO_LIBRARIES_DIALOG_SIZE,
  AddToLibrariesDialog,
  AddedLibrary,
  BookToAdd,
  addedMessage,
} from '../../libraries/add-to-libraries-dialog/add-to-libraries-dialog';
import { ShelfCover } from '../book-shelf/shelf-cover';

export const CATALOG_BOOK_DIALOG_SIZE = { width: '440px', maxWidth: 'calc(100vw - 32px)' };

/** Read-only details of a book of the catalog, which the user can add to their libraries. */
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
      <button mat-flat-button type="button" aria-haspopup="dialog" (click)="openAddDialog()">
        Añadir a mis bibliotecas
      </button>
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
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject<MatDialogRef<CatalogBookDialog>>(MatDialogRef);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly book = inject<CatalogBook>(MAT_DIALOG_DATA);
  protected readonly authors = this.book.authors.join(', ') || 'Autor desconocido';

  protected openAddDialog(): void {
    const { title, isbn13, isbn10, authors } = this.book;
    this.dialog
      .open<AddToLibrariesDialog, BookToAdd, AddedLibrary[]>(AddToLibrariesDialog, {
        ...ADD_TO_LIBRARIES_DIALOG_SIZE,
        data: { title, isbn13, isbn10, authors },
      })
      .afterClosed()
      .subscribe((libraries) => {
        if (libraries) {
          this.snackBar.open(addedMessage(title, libraries), undefined, { duration: 4000 });
          this.dialogRef.close();
        }
      });
  }
}
