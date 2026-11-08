import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { ManagedUsersService } from '../managed-users.service';
import { CreateUserDialog } from './create-user-dialog';

describe('CreateUserDialog', () => {
  async function setup(create = vi.fn(() => of({ user: { id: 'u1' }, password: 'secret' }))) {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [CreateUserDialog],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: ManagedUsersService, useValue: { create } },
      ],
    });
    const fixture = TestBed.createComponent(CreateUserDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const fill = async (name: string, email: string) => {
      const [nameInput, emailInput] = Array.from(element.querySelectorAll('input'));
      nameInput.value = name;
      nameInput.dispatchEvent(new Event('input'));
      emailInput.value = email;
      emailInput.dispatchEvent(new Event('input'));
      element.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { element, fill, create, close };
  }

  it('creates the user with the name and the email, and closes with the password', async () => {
    const { fill, create, close } = await setup();

    await fill(' Ana ', 'ana@email.com');

    expect(create).toHaveBeenCalledWith({ name: 'Ana', email: 'ana@email.com' });
    expect(close).toHaveBeenCalledWith({ user: { id: 'u1' }, password: 'secret' });
  });

  it('does not call the backend with an invalid email', async () => {
    const { fill, create } = await setup();

    await fill('Ana', 'ana');

    expect(create).not.toHaveBeenCalled();
  });

  it('explains that the email is already registered', async () => {
    const { element, fill, close } = await setup(
      vi.fn(() => throwError(() => new ApiError(409, 'CONFLICT ERROR', 'x'))),
    );

    await fill('Ana', 'ana@email.com');

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Ya hay un usuario');
    expect(close).not.toHaveBeenCalled();
  });
});
