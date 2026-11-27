import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiError } from '../../../core/http/api-error';
import { SharedLibrariesService } from '../shared-libraries.service';
import { SharedLibrary } from '../shared-library.model';

/** Asks for confirmation and leaves the library. Closes with `true` once it is done. */
@Component({
  selector: 'app-leave-library-dialog',
  imports: [MatButtonModule, MatDialogModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>¿Salir de «{{ library.name }}»?</h2>
    <mat-dialog-content>
      @if (library.isPublic) {
        <p>
          Dejarás de ser miembro de esta biblioteca de {{ library.ownerName }}. Como es pública, la
          seguirás encontrando en «Públicas», pero sin sus valoraciones. Tus libros, valoraciones y
          notas no cambian.
        </p>
      } @else {
        <p>
          Dejarás de ver esta biblioteca de {{ library.ownerName }}, que tendría que invitarte de
          nuevo. Tus libros, valoraciones y notas no cambian.
        </p>
      }
      <div class="error" role="alert">
        @if (errorMessage(); as message) {
          {{ message }}
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close cdkFocusInitial>Cancelar</button>
      <button
        mat-flat-button
        type="button"
        class="danger"
        [disabled]="leaving()"
        (click)="confirm()"
      >
        @if (leaving()) {
          <mat-spinner diameter="20" aria-label="Saliendo de la biblioteca" />
        } @else {
          Salir
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    h2,
    p {
      overflow-wrap: anywhere;
    }

    p {
      margin: 0;
    }

    .error:not(:empty) {
      margin-top: 16px;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }

    .danger {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveLibraryDialog {
  private readonly sharedLibraries = inject(SharedLibrariesService);
  private readonly dialogRef = inject<MatDialogRef<LeaveLibraryDialog, boolean>>(MatDialogRef);
  protected readonly library = inject<SharedLibrary>(MAT_DIALOG_DATA);

  protected readonly leaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected confirm(): void {
    this.leaving.set(true);
    this.errorMessage.set(null);
    this.sharedLibraries.leave(this.library.id).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        // The access was already lost, e.g. the owner removed it: the result is the same
        if (error instanceof ApiError && error.statusCode === 404) {
          this.dialogRef.close(true);
          return;
        }
        this.leaving.set(false);
        this.errorMessage.set('No se ha podido salir de la biblioteca. Inténtalo de nuevo.');
      },
    });
  }
}
