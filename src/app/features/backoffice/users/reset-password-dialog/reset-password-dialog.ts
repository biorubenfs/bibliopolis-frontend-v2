import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ManagedUser, ManagedUsersService, UserWithPassword } from '../managed-users.service';

export interface ResetPasswordDialogData {
  user: ManagedUser;
}

/** Asks for confirmation and resets the password. Closes with the new password, or nothing. */
@Component({
  selector: 'app-reset-password-dialog',
  imports: [MatButtonModule, MatDialogModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>Restablecer contraseña</h2>
    <mat-dialog-content>
      <p>
        Se generará una contraseña nueva para <strong>{{ data.user.name }}</strong> ({{
          data.user.email
        }}) y la actual dejará de servir.
      </p>
      <div class="error" role="alert">
        @if (errorMessage(); as message) {
          {{ message }}
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancelar</button>
      <button mat-flat-button type="button" [disabled]="resetting()" (click)="reset()">
        @if (resetting()) {
          <mat-spinner diameter="20" aria-label="Restableciendo contraseña" />
        } @else {
          Restablecer
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .error {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordDialog {
  private readonly users = inject(ManagedUsersService);
  private readonly dialogRef =
    inject<MatDialogRef<ResetPasswordDialog, UserWithPassword>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<ResetPasswordDialogData>(MAT_DIALOG_DATA);

  protected readonly resetting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected reset(): void {
    if (this.resetting()) return;
    this.resetting.set(true);
    this.errorMessage.set(null);
    this.users
      .resetPassword(this.data.user.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.dialogRef.close(result),
        error: () => {
          this.resetting.set(false);
          this.errorMessage.set('No se ha podido restablecer la contraseña. Inténtalo de nuevo.');
        },
      });
  }
}
