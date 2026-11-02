import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { saveFile } from '../../core/files/save-file';
import { SpanishPaginatorIntl } from '../../core/i18n/paginator-intl';
import { DeleteLibraryDialog } from './delete-library-dialog/delete-library-dialog';
import { LibrariesService } from './libraries.service';
import { LibraryCard } from './library-card/library-card';
import {
  LibraryFormDialog,
  LibraryFormDialogData,
} from './library-form-dialog/library-form-dialog';
import { Library, LibraryExportFormat } from './library.model';

type LoadState = 'loading' | 'loaded' | 'error';

const DIALOG_SIZE = { width: '520px', maxWidth: 'calc(100vw - 32px)' };

@Component({
  selector: 'app-libraries-page',
  imports: [
    LibraryCard,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './libraries-page.html',
  styleUrl: './libraries-page.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibrariesPage {
  private readonly librariesService = inject(LibrariesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly pageSizeOptions = [12, 24, 48];

  protected readonly libraries = signal<Library[]>([]);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(this.pageSizeOptions[0]);
  protected readonly state = signal<LoadState>('loading');
  protected readonly exportingId = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    const limit = this.pageSize();
    this.librariesService.list({ skip: this.pageIndex() * limit, limit }).subscribe({
      next: ({ items, total }) => {
        // Deleting the last library of a page leaves it empty: go back one page
        if (items.length === 0 && total > 0 && this.pageIndex() > 0) {
          this.pageIndex.update((index) => index - 1);
          this.load();
          return;
        }
        this.libraries.set(items);
        this.total.set(total);
        this.state.set('loaded');
      },
      error: () => this.state.set('error'),
    });
  }

  protected changePage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  protected openCreateDialog(): void {
    this.dialog
      .open<LibraryFormDialog, LibraryFormDialogData, Library>(LibraryFormDialog, DIALOG_SIZE)
      .afterClosed()
      .subscribe((library) => {
        if (library) {
          this.notify(`Biblioteca «${library.name}» creada`);
          this.pageIndex.set(0);
          this.load();
        }
      });
  }

  protected openEditDialog(library: Library): void {
    this.dialog
      .open<LibraryFormDialog, LibraryFormDialogData, Library>(LibraryFormDialog, {
        ...DIALOG_SIZE,
        data: { library },
      })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.libraries.update((list) =>
            list.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.notify('Cambios guardados');
        }
      });
  }

  protected openDeleteDialog(library: Library): void {
    this.dialog
      .open<DeleteLibraryDialog, Library, boolean>(DeleteLibraryDialog, {
        ...DIALOG_SIZE,
        data: library,
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.notify(`Biblioteca «${library.name}» eliminada`);
          this.load();
        }
      });
  }

  protected export(library: Library, format: LibraryExportFormat): void {
    this.exportingId.set(library.id);
    this.librariesService.export(library, format).subscribe({
      next: ({ blob, filename }) => {
        this.exportingId.set(null);
        saveFile(blob, filename);
      },
      error: () => {
        this.exportingId.set(null);
        this.notify('No se ha podido descargar la biblioteca. Inténtalo de nuevo.');
      },
    });
  }

  private notify(message: string): void {
    this.snackBar.open(message, undefined, { duration: 4000 });
  }
}
