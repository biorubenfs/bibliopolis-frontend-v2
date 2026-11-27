import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { LibrariesService } from '../libraries.service';
import { AddToLibrariesDialog, BookToAdd } from './add-to-libraries-dialog';

describe('AddToLibrariesDialog', () => {
  const book: BookToAdd = {
    title: 'Rossiya',
    isbn13: '9780595385294',
    isbn10: null,
    authors: ['Alex Shishin'],
  };
  const novela = { id: 'l1', name: 'Novela' };
  const pendientes = { id: 'l2', name: 'Pendientes' };

  async function setup(
    options: {
      libraries?: { id: string; name: string }[];
      list?: ReturnType<typeof vi.fn>;
      addBook?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    const items = options.libraries ?? [novela, pendientes];
    const list = options.list ?? vi.fn(() => of({ items, total: items.length }));
    const addBook = options.addBook ?? vi.fn(() => of({}));
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [AddToLibrariesDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: book },
        { provide: MatDialogRef, useValue: { close } },
        { provide: LibrariesService, useValue: { list, addBook } },
      ],
    });
    const fixture = TestBed.createComponent(AddToLibrariesDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const loader = TestbedHarnessEnvironment.loader(fixture);
    return {
      element,
      list,
      addBook,
      close,
      choose: async (name: string) => {
        const select = await loader.getHarness(MatSelectHarness);
        await select.open();
        await select.clickOptions({ text: name });
      },
      submit: async () => {
        element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
      },
      settle: () => fixture.whenStable(),
    };
  }

  it('adds the book to the chosen library, without the cover the catalog already has', async () => {
    const { list, addBook, close, choose, submit } = await setup();

    expect(list).toHaveBeenCalledWith({ skip: 0, limit: 100 });
    await choose('Pendientes');
    await submit();

    expect(addBook).toHaveBeenCalledWith('l2', {
      title: 'Rossiya',
      isbn13: '9780595385294',
      isbn10: null,
      authors: ['Alex Shishin'],
    });
    expect(close).toHaveBeenCalledWith('Pendientes');
  });

  it('asks for a library', async () => {
    const { element, addBook, submit } = await setup();

    await submit();

    expect(addBook).not.toHaveBeenCalled();
    expect(element.querySelector('mat-error')?.textContent).toContain('Elige una biblioteca');
  });

  it('has the library chosen when there is only one', async () => {
    const { addBook, submit } = await setup({ libraries: [novela] });

    await submit();

    expect(addBook).toHaveBeenCalledWith('l1', expect.anything());
  });

  it('explains what to do without libraries', async () => {
    const { element } = await setup({ libraries: [] });

    expect(element.textContent).toContain('Aún no tienes bibliotecas');
    expect(element.querySelector('form')).toBeNull();
  });

  it.each([
    [409, 'Este libro ya está en esa biblioteca.'],
    [500, 'No se ha podido añadir el libro'],
  ])('explains a %i', async (status, message) => {
    const { element, close, submit } = await setup({
      libraries: [novela],
      addBook: vi.fn(() => throwError(() => new ApiError(status, null, ''))),
    });

    await submit();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(close).not.toHaveBeenCalled();
  });

  it('lets the user retry when the libraries cannot be loaded', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new ApiError(500, null, '')))
      .mockReturnValue(of({ items: [novela], total: 1 }));
    const { element, settle } = await setup({ list });

    element.querySelector<HTMLButtonElement>('.status button')!.click();
    await settle();

    expect(element.querySelector('form')).not.toBeNull();
  });
});
