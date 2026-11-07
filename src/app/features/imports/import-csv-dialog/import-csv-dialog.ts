import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { Library } from '../../libraries/library.model';
import {
  IMPORT_MAX_FILE_SIZE_BYTES,
  IMPORT_MAX_FILE_SIZE_MB,
  IMPORT_MAX_ROWS,
  ImportAnalysis,
  LibraryImport,
  importErrorMessage,
} from '../import.model';
import { ImportsService } from '../imports.service';

export interface ImportCsvDialogData {
  /** The library to import into. */
  library: Pick<Library, 'id' | 'name'>;
}

export const IMPORT_DIALOG_SIZE = { width: '560px', maxWidth: 'calc(100vw - 32px)' };

type Step = 'file' | 'review';

/**
 * Asks for a CSV file, shows what the backend has understood and, once confirmed, starts the
 * import and moves to its page. The file is only read by the backend.
 */
@Component({
  selector: 'app-import-csv-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './import-csv-dialog.html',
  styleUrl: './import-csv-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportCsvDialog {
  private readonly imports = inject(ImportsService);
  private readonly dialogRef = inject<MatDialogRef<ImportCsvDialog, LibraryImport>>(MatDialogRef);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  protected readonly library = inject<ImportCsvDialogData>(MAT_DIALOG_DATA).library;

  private readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');

  protected readonly maxFileSizeMb = IMPORT_MAX_FILE_SIZE_MB;
  protected readonly maxRows = IMPORT_MAX_ROWS;

  protected readonly step = signal<Step>('file');
  protected readonly file = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly analysis = signal<ImportAnalysis | null>(null);
  protected readonly selectedColumns = signal<number[]>([]);
  protected readonly analyzing = signal(false);
  protected readonly importing = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly noValidRows = computed(() => {
    const counts = this.analysis()?.counts;
    return counts !== undefined && counts.valid + counts.alreadyInLibrary === 0;
  });
  protected readonly canImport = computed(
    () => this.selectedColumns().length > 0 && !this.noValidRows() && !this.analyzing(),
  );
  protected readonly rowsNeedingAction = computed(() => {
    const counts = this.analysis()?.counts;
    return counts ? counts.invalidIsbn + counts.missingIsbn : 0;
  });

  private analyzeSubscription?: Subscription;

  protected onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.errorMessage.set(null);

    if (file && !file.name.toLowerCase().endsWith('.csv')) {
      this.file.set(null);
      this.fileError.set('El fichero debe tener la extensión .csv.');
    } else if (file && file.size > IMPORT_MAX_FILE_SIZE_BYTES) {
      this.file.set(null);
      this.fileError.set(`El fichero supera el límite de ${IMPORT_MAX_FILE_SIZE_MB} MB.`);
    } else {
      this.file.set(file);
      this.fileError.set(null);
    }
  }

  /** Step 1 to step 2: the same validations as the real import, without creating anything. */
  protected continue(): void {
    if (!this.file()) {
      this.fileError.set(this.fileError() ?? 'Elige un fichero CSV.');
      return;
    }
    if (this.analyzing()) {
      return;
    }

    this.selectedColumns.set([]);
    this.runAnalysis(undefined, () => {
      this.step.set('review');
      this.focusStepHeading();
    });
  }

  protected back(): void {
    this.analyzeSubscription?.unsubscribe();
    this.analyzing.set(false);
    this.errorMessage.set(null);
    this.step.set('file');
    this.focusStepHeading();
  }

  protected onColumnsChange(event: MatSelectChange): void {
    const columns = event.value as number[];
    this.selectedColumns.set(columns);
    // An empty selection means "detect them" to the backend, but here it means none
    if (columns.length === 0) {
      this.analyzeSubscription?.unsubscribe();
      this.analyzing.set(false);
      return;
    }
    this.runAnalysis(columns);
  }

  protected import(): void {
    const file = this.file();
    if (!file || !this.canImport() || this.importing()) {
      return;
    }

    this.importing.set(true);
    this.errorMessage.set(null);
    this.imports
      .create({ file, libraryId: this.library.id, isbnColumns: this.selectedColumns() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.dialogRef.close(created);
          this.router.navigate(['/libraries', created.libraryId, 'imports', created.id]);
        },
        error: (error: unknown) => {
          this.importing.set(false);
          this.errorMessage.set(importErrorMessage(error));
        },
      });
  }

  private runAnalysis(isbnColumns: number[] | undefined, onSuccess?: () => void): void {
    const file = this.file();
    if (!file) {
      return;
    }

    this.analyzing.set(true);
    this.errorMessage.set(null);
    // Drop the previous request so a slow, outdated answer cannot overwrite the current columns
    this.analyzeSubscription?.unsubscribe();
    this.analyzeSubscription = this.imports
      .analyze({ file, libraryId: this.library.id, isbnColumns })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (analysis) => {
          this.analyzing.set(false);
          this.analysis.set(analysis);
          this.selectedColumns.set(analysis.isbnColumns);
          onSuccess?.();
        },
        error: (error: unknown) => {
          this.analyzing.set(false);
          this.errorMessage.set(importErrorMessage(error));
        },
      });
  }

  private focusStepHeading(): void {
    afterNextRender(() => this.stepHeading()?.nativeElement.focus(), { injector: this.injector });
  }
}
