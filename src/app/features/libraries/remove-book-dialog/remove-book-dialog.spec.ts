import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { LibrariesService } from '../libraries.service';
import { RemoveBookDialog } from './remove-book-dialog';

describe('RemoveBookDialog', () => {
  async function confirm(removeBook: ReturnType<typeof vi.fn>) {
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [RemoveBookDialog],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: { libraryId: 'l1', book: { id: 'ub1', bookTitle: 'Rossiya' } },
        },
        { provide: MatDialogRef, useValue: { close } },
        { provide: LibrariesService, useValue: { removeBook } },
      ],
    });
    const fixture = TestBed.createComponent(RemoveBookDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('button.danger')!.click();
    await fixture.whenStable();
    return { element, close };
  }

  it('removes the book and closes', async () => {
    const removeBook = vi.fn(() => of(undefined));
    const { element, close } = await confirm(removeBook);

    expect(element.querySelector('h2')?.textContent).toContain('Rossiya');
    expect(removeBook).toHaveBeenCalledWith('l1', 'ub1');
    expect(close).toHaveBeenCalledWith(true);
  });

  it('stays open and shows an error when it fails', async () => {
    const { element, close } = await confirm(vi.fn(() => throwError(() => new Error('boom'))));

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se ha podido quitar',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
