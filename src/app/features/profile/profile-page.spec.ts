import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error';
import { User } from '../../core/users/user.model';
import { UsersService } from '../../core/users/users.service';
import { ProfilePage } from './profile-page';

const user: User = {
  id: 'u1',
  name: 'Ana',
  email: 'ana@email.com',
  role: 'regular',
  avatar: '',
  createdAt: '',
  updatedAt: '',
};

describe('ProfilePage', () => {
  let currentUser: WritableSignal<User | null>;
  const setCurrentUser = vi.fn();
  const updateName = vi.fn<(name: string) => Observable<User>>();
  const updatePassword = vi.fn<() => Observable<void>>();
  const openSnackBar = vi.fn();

  async function render(initialUser: User | null = user) {
    currentUser = signal(initialUser);
    TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        { provide: AuthService, useValue: { currentUser, setCurrentUser } },
        { provide: UsersService, useValue: { updateName, updatePassword } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
      ],
    });
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function input(element: HTMLElement, name: string): HTMLInputElement {
    return element.querySelector(`input[formControlName="${name}"]`) as HTMLInputElement;
  }

  function type(element: HTMLElement, name: string, value: string): void {
    const control = input(element, name);
    control.value = value;
    control.dispatchEvent(new Event('input'));
  }

  function submit(element: HTMLElement, formIndex: number): void {
    element.querySelectorAll('form')[formIndex].dispatchEvent(new Event('submit'));
  }

  function fillPasswords(element: HTMLElement): void {
    type(element, 'currentPassword', 'old-secret');
    type(element, 'newPassword', 'new-secret');
    type(element, 'confirmPassword', 'new-secret');
  }

  beforeEach(() => vi.clearAllMocks());

  it('shows the name section before the password section', async () => {
    const { element } = await render();

    const titles = Array.from(element.querySelectorAll('h2')).map((h) => h.textContent);
    const buttons = Array.from(element.querySelectorAll('button[type="submit"]')).map((b) =>
      b.textContent?.trim(),
    );

    expect(titles).toEqual(['Datos de usuario', 'Cambiar contraseña']);
    expect(buttons).toEqual(['Actualizar perfil', 'Actualizar contraseña']);
  });

  it('fills the name with the current user', async () => {
    const { element } = await render();

    expect(input(element, 'name').value).toBe('Ana');
  });

  it('fills the name when the user arrives after the page was created', async () => {
    const { fixture, element } = await render(null);
    expect(input(element, 'name').value).toBe('');

    currentUser.set(user);
    await fixture.whenStable();

    expect(input(element, 'name').value).toBe('Ana');
  });

  it('does not overwrite a name being typed when the user arrives', async () => {
    const { fixture, element } = await render(null);
    type(element, 'name', 'Otro');

    currentUser.set(user);
    await fixture.whenStable();

    expect(input(element, 'name').value).toBe('Otro');
  });

  it('updates the name trimmed and refreshes the user kept in memory', async () => {
    const updated = { ...user, name: 'Ana María', avatar: 'new-avatar' };
    updateName.mockReturnValue(of(updated));
    const { fixture, element } = await render();

    type(element, 'name', '  Ana María  ');
    submit(element, 0);
    await fixture.whenStable();

    expect(updateName).toHaveBeenCalledWith('Ana María');
    expect(setCurrentUser).toHaveBeenCalledWith(updated);
    expect(input(element, 'name').value).toBe('Ana María');
    expect(openSnackBar).toHaveBeenCalledWith('Perfil actualizado', undefined, { duration: 4000 });
  });

  it('rejects a name that is too short once trimmed', async () => {
    const { fixture, element } = await render();

    type(element, 'name', ' a ');
    submit(element, 0);
    await fixture.whenStable();

    expect(updateName).not.toHaveBeenCalled();
    expect(element.querySelector('mat-error')?.textContent).toContain('al menos 2 caracteres');
  });

  it('shows an error and keeps the typed name when the update fails', async () => {
    updateName.mockReturnValue(throwError(() => new ApiError(500, null, 'boom')));
    const { fixture, element } = await render();

    type(element, 'name', 'Ana María');
    submit(element, 0);
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se ha podido actualizar el perfil',
    );
    expect(input(element, 'name').value).toBe('Ana María');
    expect(setCurrentUser).not.toHaveBeenCalled();
  });

  it('shows a spinner and blocks a second submit while saving the name', async () => {
    const response = new Subject<User>();
    updateName.mockReturnValue(response);
    const { fixture, element } = await render();

    type(element, 'name', 'Ana María');
    submit(element, 0);
    submit(element, 0);
    await fixture.whenStable();

    expect(updateName).toHaveBeenCalledTimes(1);
    expect(element.querySelector('mat-spinner')?.getAttribute('aria-label')).toBe(
      'Actualizando perfil',
    );
  });

  it('updates the password and leaves the form empty and without errors', async () => {
    updatePassword.mockReturnValue(of(undefined));
    const { fixture, element } = await render();

    fillPasswords(element);
    submit(element, 1);
    await fixture.whenStable();

    expect(updatePassword).toHaveBeenCalledWith({
      currentPassword: 'old-secret',
      newPassword: 'new-secret',
    });
    expect(input(element, 'currentPassword').value).toBe('');
    expect(input(element, 'newPassword').value).toBe('');
    expect(input(element, 'confirmPassword').value).toBe('');
    expect(element.querySelector('mat-error')).toBeNull();
    expect(openSnackBar).toHaveBeenCalledWith('Contraseña actualizada', undefined, {
      duration: 4000,
    });
  });

  it('does not send a new password outside the allowed length', async () => {
    const { fixture, element } = await render();

    type(element, 'currentPassword', 'old-secret');
    type(element, 'newPassword', '12345');
    submit(element, 1);
    await fixture.whenStable();
    expect(element.querySelector('mat-error')?.textContent).toContain('al menos 6 caracteres');

    type(element, 'newPassword', '123456789012345678901');
    await fixture.whenStable();
    expect(element.querySelector('mat-error')?.textContent).toContain('más de 20 caracteres');

    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('does not send the password when the repeated one does not match', async () => {
    const { fixture, element } = await render();

    type(element, 'currentPassword', 'old-secret');
    type(element, 'newPassword', 'new-secret');
    type(element, 'confirmPassword', 'other-secret');
    submit(element, 1);
    await fixture.whenStable();

    expect(updatePassword).not.toHaveBeenCalled();
    expect(element.querySelector('mat-error')?.textContent).toContain(
      'Las contraseñas no coinciden.',
    );
  });

  it('removes the mismatch error once the passwords match', async () => {
    updatePassword.mockReturnValue(of(undefined));
    const { fixture, element } = await render();

    type(element, 'currentPassword', 'old-secret');
    type(element, 'newPassword', 'new-secret');
    type(element, 'confirmPassword', 'other-secret');
    submit(element, 1);
    await fixture.whenStable();

    type(element, 'confirmPassword', 'new-secret');
    await fixture.whenStable();

    expect(element.querySelector('mat-error')).toBeNull();
  });

  it('tells the user when the current password is wrong and keeps the form', async () => {
    updatePassword.mockReturnValue(
      throwError(() => new ApiError(400, 'INVALID PASSWORD', 'invalid current password')),
    );
    const { fixture, element } = await render();

    fillPasswords(element);
    submit(element, 1);
    await fixture.whenStable();

    const alerts = element.querySelectorAll('[role="alert"]');
    expect(alerts[1].textContent).toContain('La contraseña actual no es correcta.');
    expect(input(element, 'newPassword').value).toBe('new-secret');
    expect(openSnackBar).not.toHaveBeenCalled();
  });

  it('shows a generic error when the password update fails for another reason', async () => {
    updatePassword.mockReturnValue(throwError(() => new ApiError(0, null, 'offline')));
    const { fixture, element } = await render();

    fillPasswords(element);
    submit(element, 1);
    await fixture.whenStable();

    const alerts = element.querySelectorAll('[role="alert"]');
    expect(alerts[1].textContent).toContain('No se ha podido actualizar la contraseña');
  });

  it('toggles the visibility of each password independently', async () => {
    const { fixture, element } = await render();

    (
      element.querySelector('button[aria-label="Mostrar nueva contraseña"]') as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    expect(input(element, 'newPassword').type).toBe('text');
    expect(input(element, 'currentPassword').type).toBe('password');
  });
});
