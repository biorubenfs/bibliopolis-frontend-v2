import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { SharedLibrariesService } from '../shared-libraries.service';
import { LeaveLibraryDialog } from './leave-library-dialog';

describe('LeaveLibraryDialog', () => {
  async function confirm(leave: ReturnType<typeof vi.fn>, isPublic = false) {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [LeaveLibraryDialog],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: { id: 'l1', name: 'Novela', ownerName: 'Ana', isPublic },
        },
        { provide: MatDialogRef, useValue: { close } },
        { provide: SharedLibrariesService, useValue: { leave } },
      ],
    });
    const fixture = TestBed.createComponent(LeaveLibraryDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(leave).not.toHaveBeenCalled();
    element.querySelector<HTMLButtonElement>('.danger')!.click();
    await fixture.whenStable();
    return { element, close };
  }

  it('leaves the library once confirmed', async () => {
    const leave = vi.fn(() => of(undefined));
    const { element, close } = await confirm(leave);

    expect(element.textContent).toContain('Novela');
    expect(element.textContent).toContain('Ana');
    expect(leave).toHaveBeenCalledWith('l1');
    expect(close).toHaveBeenCalledWith(true);
  });

  it('takes as done that the access was already lost', async () => {
    const { close } = await confirm(vi.fn(() => throwError(() => new ApiError(404, null, ''))));

    expect(close).toHaveBeenCalledWith(true);
  });

  it('stays open after a failure', async () => {
    const { element, close } = await confirm(
      vi.fn(() => throwError(() => new ApiError(500, null, ''))),
    );

    expect(close).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('No se ha podido salir');
  });

  it('explains that a public library will still be seen, without the ratings', async () => {
    const { element } = await confirm(
      vi.fn(() => of(undefined)),
      true,
    );

    expect(element.textContent).toContain('Como es pública, la seguirás encontrando en «Públicas»');
    expect(element.textContent).not.toContain('tendría que invitarte');
  });

  it('warns that only the owner can give the access back to a private library', async () => {
    const { element } = await confirm(vi.fn(() => of(undefined)));

    expect(element.textContent).toContain('tendría que invitarte de nuevo');
  });
});
