import { Clipboard } from '@angular/cdk/clipboard';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { GeneratedPasswordDialog } from './generated-password-dialog';

describe('GeneratedPasswordDialog', () => {
  it('shows the password once, with a button to copy it', async () => {
    const copy = vi.fn(() => true);
    TestBed.configureTestingModule({
      imports: [GeneratedPasswordDialog],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            title: 'Usuario creado',
            userName: 'Ana',
            email: 'ana@email.com',
            password: 'k7RmWq3ZpT9x',
          },
        },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: Clipboard, useValue: { copy } },
      ],
    });
    const fixture = TestBed.createComponent(GeneratedPasswordDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('code')?.textContent).toBe('k7RmWq3ZpT9x');
    expect(element.textContent).toContain('no se podrá volver a ver');

    element.querySelector<HTMLButtonElement>('[aria-label="Copiar contraseña"]')!.click();
    await fixture.whenStable();

    expect(copy).toHaveBeenCalledWith('k7RmWq3ZpT9x');
    expect(element.querySelector('[aria-label="Contraseña copiada"]')).not.toBeNull();
  });
});
