import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { UserBooksService } from '../../user-books/user-books.service';
import { LibrariesService } from '../libraries.service';
import { AddToLibrariesDialog, BookToAdd, addedMessage } from './add-to-libraries-dialog';

describe('AddToLibrariesDialog', () => {
  const book: BookToAdd = {
    title: 'Rossiya',
    isbn13: '9780595385294',
    isbn10: null,
    authors: ['Alex Shishin'],
  };
  const novela = { id: 'l1', name: 'Novela' };
  const pendientes = { id: 'l2', name: 'Pendientes' };
  const regalos = { id: 'l3', name: 'Regalos' };

  async function setup(
    options: {
      libraries?: { id: string; name: string }[];
      /** Libraries of the copy of the user, if they have one. */
      containing?: string[];
      list?: ReturnType<typeof vi.fn>;
      addBook?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    const items = options.libraries ?? [novela, pendientes, regalos];
    const list = options.list ?? vi.fn(() => of({ items, total: items.length }));
    const copies = options.containing
      ? [{ id: 'ub1', bookIsbn13: book.isbn13, bookIsbn10: null, libraries: options.containing }]
      : [];
    const listUserBooks = vi.fn(() => of({ items: copies, total: copies.length }));
    const addBook = options.addBook ?? vi.fn(() => of({}));
    const close = vi.fn();
    const backdropClick = new Subject<void>();
    const keydownEvents = new Subject<KeyboardEvent>();
    const dialogRef = {
      close,
      disableClose: false,
      backdropClick: () => backdropClick,
      keydownEvents: () => keydownEvents,
    };
    TestBed.configureTestingModule({
      imports: [AddToLibrariesDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: book },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: LibrariesService, useValue: { list, addBook } },
        { provide: UserBooksService, useValue: { list: listUserBooks } },
      ],
    });
    const fixture = TestBed.createComponent(AddToLibrariesDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const checkbox = (name: string) =>
      loader.getHarness(MatCheckboxHarness.with({ label: new RegExp(`^${name}`) }));
    return {
      element,
      dialogRef,
      list,
      listUserBooks,
      addBook,
      close,
      backdropClick,
      keydownEvents,
      checkbox,
      check: async (...names: string[]) => {
        for (const name of names) {
          await (await checkbox(name)).check();
        }
      },
      submitButton: () => element.querySelector<HTMLButtonElement>('button[type="submit"]')!,
      submit: async () => {
        element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
      },
      settle: () => fixture.whenStable(),
    };
  }

  it('looks for the libraries of the user and their copy of the book', async () => {
    const { list, listUserBooks } = await setup();

    expect(list).toHaveBeenCalledWith({ skip: 0, limit: 100 });
    expect(listUserBooks).toHaveBeenCalledWith({ skip: 0, limit: 5, search: '9780595385294' });
  });

  it('adds the book to every chosen library, without the cover the catalog already has', async () => {
    const { addBook, close, check, submit } = await setup();

    await check('Novela', 'Regalos');
    await submit();

    const body = {
      title: 'Rossiya',
      isbn13: '9780595385294',
      isbn10: null,
      authors: ['Alex Shishin'],
    };
    expect(addBook).toHaveBeenCalledTimes(2);
    expect(addBook).toHaveBeenCalledWith('l1', body);
    expect(addBook).toHaveBeenCalledWith('l3', body);
    expect(close).toHaveBeenCalledWith([novela, regalos]);
  });

  it('shows checked and disabled the libraries that already contain the book', async () => {
    const { checkbox, element } = await setup({ containing: ['l2'] });

    const contains = await checkbox('Pendientes');
    expect(await contains.isChecked()).toBe(true);
    expect(await contains.isDisabled()).toBe(true);
    expect(await contains.getLabelText()).toContain('Ya está');
    expect(await (await checkbox('Novela')).isDisabled()).toBe(false);
    expect(element.textContent).not.toContain('todas tus bibliotecas');
  });

  it('cannot add without choosing a library', async () => {
    const { addBook, submitButton, submit } = await setup();

    expect(submitButton().getAttribute('aria-disabled')).toBe('true');
    await submit();

    expect(addBook).not.toHaveBeenCalled();
  });

  it('has the library chosen when only one does not contain the book', async () => {
    const { addBook, submit } = await setup({ containing: ['l1', 'l3'] });

    await submit();

    expect(addBook).toHaveBeenCalledWith('l2', expect.anything());
  });

  it('says so when every library already contains the book', async () => {
    const { element } = await setup({ containing: ['l1', 'l2', 'l3'] });

    expect(element.textContent).toContain('ya está en todas tus bibliotecas');
    expect(element.querySelector('form')).toBeNull();
  });

  it('explains what to do without libraries', async () => {
    const { element } = await setup({ libraries: [] });

    expect(element.textContent).toContain('Aún no tienes bibliotecas');
    expect(element.querySelector('form')).toBeNull();
  });

  it('counts a library that already had the book as added', async () => {
    const { close, check, submit } = await setup({
      addBook: vi.fn(() => throwError(() => new ApiError(409, null, ''))),
    });

    await check('Novela');
    await submit();

    expect(close).toHaveBeenCalledWith([novela]);
  });

  it('keeps the failed libraries checked to try again, and the added ones as contained', async () => {
    const addBook = vi.fn((libraryId: string) =>
      libraryId === 'l3' ? throwError(() => new ApiError(500, null, '')) : of({}),
    );
    const { element, close, checkbox, check, submit } = await setup({ addBook });

    await check('Novela', 'Regalos');
    await submit();

    expect(close).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se ha podido añadir a «Regalos»',
    );
    expect(await (await checkbox('Novela')).isDisabled()).toBe(true);
    const failed = await checkbox('Regalos');
    expect(await failed.isChecked()).toBe(true);
    expect(await failed.isDisabled()).toBe(false);

    addBook.mockReturnValue(of({}));
    await submit();

    expect(addBook).toHaveBeenLastCalledWith('l3', expect.anything());
    expect(close).toHaveBeenCalledWith([novela, regalos]);
  });

  it('keeps the libraries already added when closed with Escape or the backdrop', async () => {
    const addBook = vi.fn((libraryId: string) =>
      libraryId === 'l3' ? throwError(() => new ApiError(500, null, '')) : of({}),
    );
    const { dialogRef, close, keydownEvents, check, submit } = await setup({ addBook });

    expect(dialogRef.disableClose).toBe(true);
    await check('Novela', 'Regalos');
    await submit();
    keydownEvents.next(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(close).toHaveBeenCalledWith([novela]);
  });

  it('closes with nothing when no library was added', async () => {
    const { close, backdropClick } = await setup();

    backdropClick.next();

    expect(close).toHaveBeenCalledWith(undefined);
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

describe('addedMessage', () => {
  it('names a single library and counts several', () => {
    expect(addedMessage('Dune', [{ id: 'l1', name: 'Novela' }])).toBe('«Dune» añadido a «Novela»');
    expect(
      addedMessage('Dune', [
        { id: 'l1', name: 'Novela' },
        { id: 'l2', name: 'Pendientes' },
      ]),
    ).toBe('«Dune» añadido a 2 bibliotecas');
  });
});
