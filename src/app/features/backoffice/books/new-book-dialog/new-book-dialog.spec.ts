import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { ExternalBook } from '../../../books/external-book.model';
import { ExternalBooksService } from '../../../books/external-books.service';
import { CatalogBook } from '../catalog-book.model';
import { CatalogBooksService } from '../catalog-books.service';
import { NewBookDialog } from './new-book-dialog';

const ISBN = '9780595385294';

const fromSources: ExternalBook = {
  title: 'Rossiya',
  isbn13: ISBN,
  isbn10: '059538529X',
  authors: ['Alex Shishin'],
  cover: { source: 'open_library', value: '1304487' },
  coverUrl: 'https://covers.example/1.jpg',
};

const inCatalog: CatalogBook = {
  id: 'b1',
  title: 'Rossiya',
  authors: ['Alex Shishin'],
  isbn13: ISBN,
  isbn10: '059538529X',
  coverUrl: null,
  createdAt: '',
  updatedAt: '',
};

const httpError = (statusCode: number) => () =>
  throwError(() => new ApiError(statusCode, null, 'error'));

describe('NewBookDialog', () => {
  async function setup(
    options: {
      findInCatalog?: ReturnType<typeof vi.fn>;
      findInSources?: ReturnType<typeof vi.fn>;
      create?: ReturnType<typeof vi.fn>;
      scanned?: string;
    } = {},
  ) {
    const findInCatalog = options.findInCatalog ?? vi.fn(() => of(null));
    const findInSources = options.findInSources ?? vi.fn(() => of(fromSources));
    const create = options.create ?? vi.fn(() => of(inCatalog));
    const close = vi.fn();
    const openDialog = vi.fn(() => ({ afterClosed: () => of(options.scanned) }));
    TestBed.configureTestingModule({
      imports: [NewBookDialog],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: CatalogBooksService, useValue: { findByIsbn: findInCatalog, create } },
        { provide: ExternalBooksService, useValue: { findByIsbn: findInSources } },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: { open: openDialog } });
    const fixture = TestBed.createComponent(NewBookDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const type = async (selector: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const button = (text: string) =>
      Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
    const click = async (text: string) => {
      button(text)!.click();
      await fixture.whenStable();
    };
    const search = async (isbn = ISBN) => {
      await type('input[formControlName="isbn"]', isbn);
      await click('Buscar');
    };
    const submit = async () => {
      element.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };

    return {
      element,
      type,
      button,
      click,
      search,
      submit,
      findInCatalog,
      findInSources,
      create,
      close,
      openDialog,
    };
  }

  it('offers editing a book that is already in the catalog, without asking the sources', async () => {
    const { element, search, click, findInSources, create, close } = await setup({
      findInCatalog: vi.fn(() => of(inCatalog)),
    });

    await search();
    expect(element.textContent).toContain('ya está en el catálogo');
    expect(findInSources).not.toHaveBeenCalled();

    await click('Editar libro');
    expect(close).toHaveBeenCalledWith({ kind: 'edit', book: inCatalog });
    expect(create).not.toHaveBeenCalled();
  });

  it('shows the book of the sources and creates it from them', async () => {
    const { element, search, submit, create, close } = await setup();

    await search('978-0-595-38529-4');
    expect(element.querySelector('app-book-preview')?.textContent).toContain('Rossiya');

    await submit();
    expect(create).toHaveBeenCalledWith({ mode: 'sources', isbn: ISBN });
    expect(close).toHaveBeenCalledWith({ kind: 'created', book: inCatalog });
  });

  it('opens the manual entry with the ISBN when no source has the book', async () => {
    const { element, search, type, submit, create } = await setup({
      findInSources: vi.fn(httpError(404)),
    });

    await search();
    expect(element.textContent).toContain('No hemos encontrado ese ISBN');
    expect(element.querySelector<HTMLInputElement>('input[formControlName="isbn"]')!.value).toBe(
      ISBN,
    );

    await type('input[formControlName="title"]', ' Rossiya ');
    await type('input[formControlName="authors"]', 'Alex Shishin, Otro Autor');
    await submit();

    expect(create).toHaveBeenCalledWith({
      mode: 'manual',
      isbn: ISBN,
      title: 'Rossiya',
      authors: ['Alex Shishin', 'Otro Autor'],
    });
  });

  it('opens the manual entry straight away, without searching', async () => {
    const { click, type, submit, create, findInCatalog } = await setup();

    await click('Escribir los datos a mano');
    await type('input[formControlName="isbn"]', '059538529X');
    await type('input[formControlName="title"]', 'Rossiya');
    await type('input[formControlName="authors"]', 'Alex Shishin');
    await submit();

    expect(findInCatalog).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      mode: 'manual',
      isbn: '059538529X',
      title: 'Rossiya',
      authors: ['Alex Shishin'],
    });
  });

  it('does not search an invalid ISBN', async () => {
    const { element, search, findInCatalog } = await setup();

    await search('9780595385290');

    expect(findInCatalog).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Ese ISBN no es válido');
  });

  it('searches the scanned ISBN', async () => {
    const { element, findInCatalog, openDialog } = await setup({ scanned: ISBN });

    element.querySelector<HTMLButtonElement>('[aria-label="Escanear el ISBN"]')!.click();

    expect(openDialog).toHaveBeenCalled();
    expect(findInCatalog).toHaveBeenCalledWith(ISBN);
  });

  it('shows the conflict when the book was added meanwhile', async () => {
    const { element, search, submit } = await setup({ create: vi.fn(httpError(409)) });

    await search();
    await submit();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Este libro ya está en el catálogo',
    );
  });
});
