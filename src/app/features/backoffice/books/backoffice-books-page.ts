import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { SpanishPaginatorIntl } from '../../../core/i18n/paginator-intl';
import { SearchableList } from '../shared/searchable-list';
import { CatalogBook } from './catalog-book.model';
import { CatalogBooksService } from './catalog-books.service';
import { EditBookDialog, EditBookDialogData } from './edit-book-dialog/edit-book-dialog';
import { NewBookDialog, NewBookDialogResult } from './new-book-dialog/new-book-dialog';

const DIALOG_SIZE = { width: '560px', maxWidth: 'calc(100vw - 32px)' };

/** Searches the catalog, adds books to it and corrects them. */
@Component({
  selector: 'app-backoffice-books-page',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './backoffice-books-page.html',
  styleUrls: ['../shared/backoffice-page.scss', './backoffice-books-page.scss'],
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackofficeBooksPage extends SearchableList<CatalogBook> {
  private readonly catalog = inject(CatalogBooksService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected fetch(options: { skip: number; limit: number; search: string }) {
    return this.catalog.list(options);
  }

  protected openNewBookDialog(): void {
    this.dialog
      .open<NewBookDialog, void, NewBookDialogResult>(NewBookDialog, DIALOG_SIZE)
      .afterClosed()
      .subscribe((result) => {
        if (result?.kind === 'created') {
          this.snackBar.open(`«${result.book.title}» dado de alta`, undefined, { duration: 4000 });
          this.load({ quiet: true });
        } else if (result?.kind === 'edit') {
          this.openEditDialog(result.book);
        }
      });
  }

  protected openEditDialog(book: CatalogBook): void {
    this.dialog
      .open<EditBookDialog, EditBookDialogData, CatalogBook>(EditBookDialog, {
        ...DIALOG_SIZE,
        data: { book },
      })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.replaceItem(updated);
          this.snackBar.open('Cambios guardados', undefined, { duration: 4000 });
        }
      });
  }
}
