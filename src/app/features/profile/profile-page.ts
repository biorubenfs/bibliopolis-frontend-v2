import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroupDirective,
  NgForm,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error';
import { UsersService } from '../../core/users/users.service';

const NAME_MIN_LENGTH = 2;
/** Same limits as the backend. */
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 20;

/** The name is sent trimmed, so surrounding spaces must not count towards the minimum length. */
function trimmedNameLength(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length < NAME_MIN_LENGTH ? { nameLength: true } : null;
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { newPassword, confirmPassword } = group.value as {
    newPassword: string;
    confirmPassword: string;
  };
  return newPassword === confirmPassword ? null : { passwordMismatch: true };
}

/** The mismatch error lives on the form, so the confirmation field has to be told to show it. */
class PasswordMismatchErrorMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const invalid = !!control?.invalid || !!form?.hasError('passwordMismatch');
    return invalid && (!!control?.touched || !!form?.submitted);
  }
}

@Component({
  selector: 'app-profile-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UsersService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly nameMinLength = NAME_MIN_LENGTH;
  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  protected readonly passwordMaxLength = PASSWORD_MAX_LENGTH;
  protected readonly mismatchErrorMatcher = new PasswordMismatchErrorMatcher();

  protected readonly nameForm = this.formBuilder.group({
    name: ['', [Validators.required, trimmedNameLength]],
  });
  protected readonly passwordForm = this.formBuilder.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(PASSWORD_MIN_LENGTH),
          Validators.maxLength(PASSWORD_MAX_LENGTH),
        ],
      ],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  protected readonly savingName = signal(false);
  protected readonly nameError = signal<string | null>(null);
  protected readonly savingPassword = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly currentPasswordVisible = signal(false);
  protected readonly newPasswordVisible = signal(false);
  protected readonly confirmPasswordVisible = signal(false);

  constructor() {
    // After a page reload the user arrives once this page exists; never overwrite what was typed
    effect(() => {
      const name = this.auth.currentUser()?.name;
      if (name !== undefined && this.nameForm.pristine) {
        this.nameForm.reset({ name });
      }
    });
  }

  protected submitName(formDirective: FormGroupDirective): void {
    if (this.nameForm.invalid || this.savingName()) {
      this.nameForm.markAllAsTouched();
      return;
    }

    this.savingName.set(true);
    this.nameError.set(null);

    this.users.updateName(this.nameForm.controls.name.value.trim()).subscribe({
      next: (user) => {
        this.savingName.set(false);
        // Keeps the sidebar (name and avatar) in sync without asking the backend again
        this.auth.setCurrentUser(user);
        formDirective.resetForm({ name: user.name });
        this.snackBar.open('Perfil actualizado', undefined, { duration: 4000 });
      },
      error: () => {
        this.savingName.set(false);
        this.nameError.set('No se ha podido actualizar el perfil. Inténtalo de nuevo.');
      },
    });
  }

  protected submitPassword(formDirective: FormGroupDirective): void {
    if (this.passwordForm.invalid || this.savingPassword()) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.savingPassword.set(true);
    this.passwordError.set(null);

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.users.updatePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        // resetForm also clears the "submitted" state; otherwise the emptied fields show errors
        formDirective.resetForm();
        this.currentPasswordVisible.set(false);
        this.newPasswordVisible.set(false);
        this.confirmPasswordVisible.set(false);
        this.snackBar.open('Contraseña actualizada', undefined, { duration: 4000 });
      },
      error: (error: unknown) => {
        this.savingPassword.set(false);
        this.passwordError.set(
          error instanceof ApiError && error.statusCode === 400
            ? 'La contraseña actual no es correcta.'
            : 'No se ha podido actualizar la contraseña. Inténtalo de nuevo.',
        );
      },
    });
  }

  protected toggleVisibility(visible: WritableSignal<boolean>): void {
    visible.update((value) => !value);
  }
}
