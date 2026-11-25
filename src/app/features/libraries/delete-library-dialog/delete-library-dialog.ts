import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { LibrariesService } from '../libraries.service';
import { Library } from '../library.model';
import { LibraryMembersService } from '../library-members.service';

/** Asks for confirmation and deletes the library. Closes with `true` once it is deleted. */
@Component({
  selector: 'app-delete-library-dialog',
  imports: [MatButtonModule, MatDialogModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>¿Eliminar «{{ library.name }}»?</h2>
    <mat-dialog-content>
      <p>
        Los libros no se borran: solo dejarán de estar en esta biblioteca y seguirán disponibles en
        «Libros».
      </p>
      <!-- Always there, so screen readers announce the warning when it arrives -->
      <p class="members" role="status">
        @if (membersCount() === 1) {
          La compartes con 1 persona, que dejará de verla.
        } @else if (membersCount() > 1) {
          La compartes con {{ membersCount() }} personas, que dejarán de verla.
        }
      </p>
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
        [disabled]="deleting()"
        (click)="confirm()"
      >
        @if (deleting()) {
          <mat-spinner diameter="20" aria-label="Eliminando biblioteca" />
        } @else {
          Eliminar
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    p {
      margin: 0;
    }

    .members:not(:empty) {
      margin-top: 16px;
      color: var(--mat-sys-on-surface);
      font-weight: 500;
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
export class DeleteLibraryDialog {
  private readonly libraries = inject(LibrariesService);
  private readonly dialogRef = inject<MatDialogRef<DeleteLibraryDialog, boolean>>(MatDialogRef);
  protected readonly library = inject<Library>(MAT_DIALOG_DATA);

  /** People who will lose access to the library; 0 until it is known. */
  protected readonly membersCount = signal(0);
  protected readonly deleting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    // The pagination total says how many they are, without loading them
    inject(LibraryMembersService)
      .list(this.library.id, { skip: 0, limit: 1 })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ total }) => this.membersCount.set(total),
        // Not knowing the count must not prevent the deletion
        error: () => undefined,
      });
  }

  protected confirm(): void {
    this.deleting.set(true);
    this.errorMessage.set(null);
    this.libraries.delete(this.library.id).subscribe({
      next: () => this.dialogRef.close(true),
      error: () => {
        this.deleting.set(false);
        this.errorMessage.set('No se ha podido eliminar la biblioteca. Inténtalo de nuevo.');
      },
    });
  }
}
