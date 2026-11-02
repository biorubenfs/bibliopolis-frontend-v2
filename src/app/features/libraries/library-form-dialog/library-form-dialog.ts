import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { LibrariesService } from '../libraries.service';
import {
  LIBRARY_DESCRIPTION_MAX_LENGTH,
  LIBRARY_NAME_MAX_LENGTH,
  LIBRARY_NAME_MIN_LENGTH,
  Library,
} from '../library.model';

export interface LibraryFormDialogData {
  /** Library to edit; when absent the dialog creates a new one. */
  library?: Library;
}

/** Creates or edits a library. Closes with the saved library, or with nothing when cancelled. */
@Component({
  selector: 'app-library-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './library-form-dialog.html',
  styleUrl: './library-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryFormDialog {
  private readonly libraries = inject(LibrariesService);
  private readonly dialogRef = inject<MatDialogRef<LibraryFormDialog, Library>>(MatDialogRef);
  private readonly library = inject<LibraryFormDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  })?.library;

  protected readonly isEdit = this.library !== undefined;
  protected readonly nameMinLength = LIBRARY_NAME_MIN_LENGTH;
  protected readonly nameMaxLength = LIBRARY_NAME_MAX_LENGTH;
  protected readonly descriptionMaxLength = LIBRARY_DESCRIPTION_MAX_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [
      this.library?.name ?? '',
      [
        Validators.required,
        Validators.minLength(LIBRARY_NAME_MIN_LENGTH),
        Validators.maxLength(LIBRARY_NAME_MAX_LENGTH),
      ],
    ],
    description: [
      this.library?.description ?? '',
      [Validators.required, Validators.maxLength(LIBRARY_DESCRIPTION_MAX_LENGTH)],
    ],
  });

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const values = {
      name: this.form.controls.name.value.trim(),
      description: this.form.controls.description.value.trim(),
    };
    const request: Observable<Library> = this.library
      ? this.libraries.update(this.library.id, values)
      : this.libraries.create(values);

    request.subscribe({
      next: (library) => this.dialogRef.close(library),
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(
          error instanceof ApiError && error.statusCode === 409
            ? 'Ya tienes una biblioteca con ese nombre.'
            : 'No se ha podido guardar la biblioteca. Inténtalo de nuevo.',
        );
      },
    });
  }
}
