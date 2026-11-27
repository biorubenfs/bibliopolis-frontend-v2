import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { tap } from 'rxjs';

import { saveFile } from '../../core/files/save-file';
import { SpanishPaginatorIntl } from '../../core/i18n/paginator-intl';
import { SearchableList } from '../../core/lists/searchable-list';
import { LibraryCounts } from '../libraries/libraries-section/library-counts';
import { LibraryExportFormat } from '../libraries/library.model';
import { SharedLibrariesService } from '../shared-libraries/shared-libraries.service';
import { SharedLibraryCard } from '../shared-libraries/shared-library-card/shared-library-card';
import { PublicLibrariesService } from './public-libraries.service';
import { PublicLibrary } from './public-library.model';

/** «Públicas»: the libraries that other users let anyone see. */
@Component({
  selector: 'app-public-libraries-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    RouterLink,
    SharedLibraryCard,
  ],
  templateUrl: './public-libraries-page.html',
  styleUrl: './public-libraries-page.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: SpanishPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicLibrariesPage extends SearchableList<PublicLibrary> {
  private readonly publicLibraries = inject(PublicLibrariesService);
  private readonly sharedLibraries = inject(SharedLibrariesService);
  private readonly counts = inject(LibraryCounts);
  private readonly snackBar = inject(MatSnackBar);

  /** The library whose export is being downloaded, if any. */
  protected readonly exportingId = signal<string | null>(null);

  /** Own libraries that match the search: they are not listed here. */
  protected readonly ownMatches = computed(() => (this.search() ? this.counts.own() : null));

  protected fetch(options: { skip: number; limit: number; search: string }) {
    return this.publicLibraries.list(options).pipe(
      tap({
        next: ({ total }) => this.counts.public.set(total),
        error: () => this.counts.public.set(null),
      }),
    );
  }

  protected export(library: PublicLibrary, format: LibraryExportFormat): void {
    this.exportingId.set(library.id);
    this.sharedLibraries.export(library, format).subscribe({
      next: ({ blob, filename }) => {
        this.exportingId.set(null);
        saveFile(blob, filename);
      },
      error: () => {
        this.exportingId.set(null);
        this.snackBar.open(
          'No se ha podido descargar la biblioteca. Inténtalo de nuevo.',
          undefined,
          { duration: 4000 },
        );
      },
    });
  }
}
