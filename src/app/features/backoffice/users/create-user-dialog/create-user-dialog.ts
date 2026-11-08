import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiError } from '../../../../core/http/api-error';
import { ManagedUsersService, UserWithPassword } from '../managed-users.service';

/** Creates a regular user. Closes with the user and the generated password, or nothing. */
@Component({
  selector: 'app-create-user-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Nuevo usuario</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content>
        <p class="intro">
          Se creará un usuario normal con una contraseña generada, que verás al terminar.
        </p>
        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" autocomplete="off" required />
          <mat-error>Introduce el nombre.</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="off" required />
          <mat-error>Introduce un email válido.</mat-error>
        </mat-form-field>
        <div class="error" role="alert">
          @if (errorMessage(); as message) {
            {{ message }}
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          @if (saving()) {
            <mat-spinner diameter="20" aria-label="Creando usuario" />
          } @else {
            Crear
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .intro {
      margin: 0 0 8px;
      color: var(--mat-sys-on-surface-variant);
    }

    .error {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateUserDialog {
  private readonly users = inject(ManagedUsersService);
  private readonly dialogRef =
    inject<MatDialogRef<CreateUserDialog, UserWithPassword>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    email: ['', [Validators.required, Validators.email]],
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
    const { name, email } = this.form.getRawValue();
    this.users
      .create({ name: name.trim(), email: email.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.dialogRef.close(result),
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorMessage.set(
            error instanceof ApiError && error.statusCode === 409
              ? 'Ya hay un usuario con ese email.'
              : 'No se ha podido crear el usuario. Inténtalo de nuevo.',
          );
        },
      });
  }
}
