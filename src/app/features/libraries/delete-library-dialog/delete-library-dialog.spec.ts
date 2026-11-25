import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { LibrariesService } from '../libraries.service';
import { LibraryMembersService } from '../library-members.service';
import { DeleteLibraryDialog } from './delete-library-dialog';

describe('DeleteLibraryDialog', () => {
  async function setup(list: ReturnType<typeof vi.fn>) {
    const close = vi.fn();
    const remove = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({
      imports: [DeleteLibraryDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { id: 'l1', name: 'Novela' } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: LibrariesService, useValue: { delete: remove } },
        { provide: LibraryMembersService, useValue: { list } },
      ],
    });
    const fixture = TestBed.createComponent(DeleteLibraryDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const warning = () => element.querySelector('.members')!.textContent!.trim();
    return { element, warning, remove, close };
  }

  const shared = (total: number) => vi.fn(() => of({ items: [], total }));

  it.each([
    [0, ''],
    [1, 'La compartes con 1 persona, que dejará de verla.'],
    [4, 'La compartes con 4 personas, que dejarán de verla.'],
  ])('warns about the %i people who will lose access', async (total, expected) => {
    const list = shared(total);
    const { warning } = await setup(list);

    expect(list).toHaveBeenCalledWith('l1', { skip: 0, limit: 1 });
    expect(warning()).toBe(expected);
  });

  it('deletes the library even if the people could not be counted', async () => {
    const { element, warning, remove, close } = await setup(
      vi.fn(() => throwError(() => new Error())),
    );
    expect(warning()).toBe('');

    element.querySelector<HTMLButtonElement>('.danger')!.click();

    expect(remove).toHaveBeenCalledWith('l1');
    expect(close).toHaveBeenCalledWith(true);
  });
});
