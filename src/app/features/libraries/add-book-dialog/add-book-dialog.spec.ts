import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { ExternalBook } from '../../books/external-book.model';
import { ExternalBooksService } from '../../books/external-books.service';
import { LibrariesService } from '../libraries.service';
import { AddBookDialog } from './add-book-dialog';

const rossiya: ExternalBook = {
  title: 'Rossiya',
  isbn13: '9780595385294',
  isbn10: '059538529X',
  authors: ['Alex Shishin'],
  cover: { source: 'open_library', value: '1304487' },
  coverUrl: 'https://covers.example/1.jpg',
};

const httpError = (statusCode: number) => () =>
  throwError(() => new ApiError(statusCode, null, 'error'));

describe('AddBookDialog', () => {
  async function setup(
    options: {
      findByIsbn?: ReturnType<typeof vi.fn>;
      addBook?: ReturnType<typeof vi.fn>;
      isbn?: string;
    } = {},
  ) {
    const findByIsbn = options.findByIsbn ?? vi.fn(() => of(rossiya));
    const addBook = options.addBook ?? vi.fn(() => of({}));
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [AddBookDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { libraryId: 'l1', isbn: options.isbn } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: ExternalBooksService, useValue: { findByIsbn } },
        { provide: LibrariesService, useValue: { addBook } },
      ],
    });
    const fixture = TestBed.createComponent(AddBookDialog);
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
    const search = async (isbn = '9780595385294') => {
      await type('input[formControlName="isbn"]', isbn);
      button('Buscar')!.click();
      await fixture.whenStable();
    };
    const submit = async () => {
      button('Añadir')!.click();
      await fixture.whenStable();
    };

    return { element, findByIsbn, addBook, close, type, button, search, submit };
  }

  it('searches straight away for an ISBN it receives', async () => {
    const { element, findByIsbn } = await setup({ isbn: '9780595385294' });

    expect(findByIsbn).toHaveBeenCalledExactlyOnceWith('9780595385294');
    expect(element.querySelector('.preview')?.textContent).toContain('Rossiya');
  });

  it('does not search without an ISBN', async () => {
    const { search, findByIsbn } = await setup();

    await search('   ');

    expect(findByIsbn).not.toHaveBeenCalled();
  });

  it('adds the book that was found, with its cover', async () => {
    const { element, search, submit, addBook, close } = await setup();

    await search(' 9780595385294 ');
    expect(element.querySelector('.preview')?.textContent).toContain('Rossiya');
    await submit();

    expect(addBook).toHaveBeenCalledWith('l1', {
      title: 'Rossiya',
      isbn13: '9780595385294',
      isbn10: '059538529X',
      authors: ['Alex Shishin'],
      cover: { source: 'open_library', value: '1304487' },
    });
    expect(close).toHaveBeenCalledWith('Rossiya');
  });

  it('forgets the result when the ISBN changes', async () => {
    const { element, search, type, button } = await setup();

    await search();
    await type('input[formControlName="isbn"]', '9780000000000');

    expect(element.querySelector('.preview')).toBeNull();
    expect(button('Añadir')).toBeUndefined();
  });

  it('asks for the data of a book nobody knows and adds it with the searched ISBN', async () => {
    const { element, search, type, submit, addBook, close } = await setup({
      findByIsbn: vi.fn(httpError(404)),
    });

    await search('978-0-595-38529-4');
    expect(element.textContent).toContain('No hemos encontrado ese ISBN');

    await submit();
    expect(addBook).not.toHaveBeenCalled();

    await type('input[formControlName="title"]', ' Rossiya ');
    await type('input[formControlName="authors"]', 'Alex Shishin, Otra Autora,');
    await submit();

    expect(addBook).toHaveBeenCalledWith('l1', {
      title: 'Rossiya',
      isbn13: '9780595385294',
      isbn10: null,
      authors: ['Alex Shishin', 'Otra Autora'],
    });
    expect(close).toHaveBeenCalledWith('Rossiya');
  });

  it('sends a typed ISBN-10 as such', async () => {
    const { search, type, submit, addBook } = await setup({ findByIsbn: vi.fn(httpError(404)) });

    await search('059538529X');
    await type('input[formControlName="title"]', 'Rossiya');
    await type('input[formControlName="authors"]', 'Alex Shishin');
    await submit();

    expect(addBook).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ isbn13: null, isbn10: '059538529X' }),
    );
  });

  it('explains that an ISBN is not valid', async () => {
    const { element, search, button } = await setup({ findByIsbn: vi.fn(httpError(400)) });

    await search('123');

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('no es válido');
    expect(button('Añadir')).toBeUndefined();
  });

  it('stays open and explains that the library already has the book', async () => {
    const { element, search, submit, close } = await setup({ addBook: vi.fn(httpError(409)) });

    await search();
    await submit();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'ya está en esta biblioteca',
    );
    expect(close).not.toHaveBeenCalled();
  });
});
