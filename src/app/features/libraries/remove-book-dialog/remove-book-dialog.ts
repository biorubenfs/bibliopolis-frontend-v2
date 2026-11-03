import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { UserBook } from '../../user-books/user-book.model';
import { LibrariesService } from '../libraries.service';

export interface RemoveBookDialogData {
  libraryId: string;
  book: UserBook;
}

/** Asks for confirmation and removes the book from the library. Closes with `true` once done. */
@Component({
  selector: 'app-remove-book-dialog',
  imports: [MatButtonModule, MatDialogModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>¿Quitar «{{ data.book.bookTitle }}»?</h2>
    <mat-dialog-content>
      <p>
        El libro solo dejará de estar en esta biblioteca. Su valoración y sus notas se conservan en
        «Mis libros».
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
        [disabled]="removing()"
        (click)="confirm()"
      >
        @if (removing()) {
          <mat-spinner diameter="20" aria-label="Quitando libro" />
        } @else {
          Quitar
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
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
export class RemoveBookDialog {
  private readonly libraries = inject(LibrariesService);
  private readonly dialogRef = inject<MatDialogRef<RemoveBookDialog, boolean>>(MatDialogRef);
  protected readonly data = inject<RemoveBookDialogData>(MAT_DIALOG_DATA);

  protected readonly removing = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected confirm(): void {
    this.removing.set(true);
    this.errorMessage.set(null);
    this.libraries.removeBook(this.data.libraryId, this.data.book.id).subscribe({
      next: () => this.dialogRef.close(true),
      error: () => {
        this.removing.set(false);
        this.errorMessage.set('No se ha podido quitar el libro. Inténtalo de nuevo.');
      },
    });
  }
}
