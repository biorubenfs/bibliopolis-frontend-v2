import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { UserBook } from '../../user-books/user-book.model';
import { UserBooksService } from '../../user-books/user-books.service';
import { RemoveBookDialog } from '../remove-book-dialog/remove-book-dialog';
import { BookDetailDialog } from './book-detail-dialog';

const book: UserBook = {
  id: 'ub1',
  libraries: ['l1'],
  bookId: 'b1',
  bookTitle: 'Rossiya',
  bookAuthors: ['Alex Shishin', 'Otra Autora'],
  bookCoverUrl: 'https://covers.example/1.jpg',
  bookIsbn13: '9780595385294',
  bookIsbn10: '059538529X',
  rating: 8,
  notes: 'Muy recomendable',
  userId: 'u1',
  createdAt: '',
  updatedAt: '',
};

describe('BookDetailDialog', () => {
  async function setup(
    options: {
      overrides?: Partial<UserBook>;
      /** The library the dialog is opened from; null opens it outside any library. */
      libraryId?: string | null;
      removeResult?: boolean;
      update?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    const close = vi.fn();
    const open = vi.fn(() => ({ afterClosed: () => of(options.removeResult) }));
    const update =
      options.update ??
      vi.fn((_id: string, changes: Partial<UserBook>) => of({ ...book, ...changes }));
    const libraryId = options.libraryId === undefined ? 'l1' : (options.libraryId ?? undefined);
    const data = { libraryId, book: { ...book, ...options.overrides } };
    // MatDialogModule brings its own MatDialog, which a plain provider would not replace
    TestBed.overrideProvider(MatDialog, { useValue: { open } });
    TestBed.configureTestingModule({
      imports: [BookDetailDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: UserBooksService, useValue: { update } },
      ],
    });
    const fixture = TestBed.createComponent(BookDetailDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const notes = element.querySelector('textarea')!;

    const clickButton = async (label: string) => {
      Array.from(element.querySelectorAll('button'))
        .find((button) => button.textContent?.includes(label))!
        .click();
      await fixture.whenStable();
    };
    const typeNotes = async (value: string) => {
      notes.value = value;
      notes.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const chooseRating = async (rating: number) => {
      element.querySelector<HTMLElement>(`button[aria-label="${rating} de 10"]`)!.click();
      await fixture.whenStable();
    };
    return {
      fixture,
      element,
      data,
      notes,
      open,
      close,
      update,
      clickButton,
      typeNotes,
      chooseRating,
    };
  }

  it('shows the data of the book with its rating and notes ready to edit', async () => {
    const { element, notes } = await setup();

    expect(element.querySelector('h2')?.textContent).toContain('Rossiya');
    expect(element.textContent).toContain('Alex Shishin, Otra Autora');
    expect(element.querySelector('app-rating-input')?.textContent).toContain('8 de 10');
    expect(element.querySelector('app-rating-input')?.getAttribute('aria-labelledby')).toBe(
      element.querySelector('.rating-label')?.id,
    );
    expect(notes.value).toBe('Muy recomendable');
    expect(element.textContent).toContain('ISBN-13: 9780595385294');
    expect(element.textContent).toContain('ISBN-10: 059538529X');
    expect(element.querySelector('img')?.getAttribute('src')).toBe(book.bookCoverUrl);
  });

  it('copes with a book without the optional data', async () => {
    const { element, notes } = await setup({
      overrides: {
        bookAuthors: [],
        bookIsbn10: null,
        bookCoverUrl: null,
        rating: null,
        notes: null,
      },
    });

    expect(element.textContent).toContain('Autor desconocido');
    expect(element.querySelector('app-rating-input')?.textContent).toContain('Sin valorar');
    expect(notes.value).toBe('');
    expect(element.textContent).not.toContain('ISBN-10');
    expect(element.querySelector('.placeholder')).not.toBeNull();
  });

  it('shows a placeholder when the cover fails to load', async () => {
    const { fixture, element } = await setup();

    element.querySelector('img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('.placeholder')).not.toBeNull();
  });

  it('does not persist anything until the user saves', async () => {
    const { update, close, typeNotes, chooseRating } = await setup();

    await typeNotes('Otra nota');
    await chooseRating(9);

    expect(update).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('saves the rating and the notes and closes with the updated book', async () => {
    const updated = { ...book, rating: 9, notes: 'Otra nota' };
    const { update, close, clickButton, typeNotes, chooseRating } = await setup({
      update: vi.fn(() => of(updated)),
    });

    await chooseRating(9);
    await typeNotes('  Otra nota ');
    await clickButton('Guardar');

    expect(update).toHaveBeenCalledWith('ub1', { rating: 9, notes: 'Otra nota' });
    expect(close).toHaveBeenCalledWith(updated);
  });

  it('can clear the rating', async () => {
    const { update, clickButton, chooseRating } = await setup();

    // Clicking on the current rating clears it
    await chooseRating(8);
    await clickButton('Guardar');

    expect(update).toHaveBeenCalledWith('ub1', { rating: null, notes: 'Muy recomendable' });
  });

  it('sends null when the notes are emptied', async () => {
    const { update, clickButton, typeNotes } = await setup();

    await typeNotes('   ');
    await clickButton('Guardar');

    expect(update).toHaveBeenCalledWith('ub1', { rating: 8, notes: null });
  });

  it('does not call the backend when saving without changes', async () => {
    const { update, close, clickButton } = await setup();

    await clickButton('Guardar');

    expect(update).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith();
  });

  it('discards the changes when cancelling', async () => {
    const { update, close, clickButton, typeNotes } = await setup();

    await typeNotes('Otra nota');
    await clickButton('Cancelar');

    expect(update).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
    expect(close.mock.lastCall?.[0]).toBeFalsy();
  });

  it('stays open, keeping what was typed, when saving fails', async () => {
    const { element, notes, close, clickButton, typeNotes } = await setup({
      update: vi.fn(() => throwError(() => new Error('boom'))),
    });

    await typeNotes('Otra nota');
    await clickButton('Guardar');

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se han podido guardar',
    );
    expect(notes.value).toBe('Otra nota');
    expect(close).not.toHaveBeenCalled();
  });

  it('closes reporting the removal once the book is removed', async () => {
    const { data, open, close, clickButton } = await setup({ removeResult: true });

    await clickButton('Quitar');

    expect(open).toHaveBeenCalledWith(
      RemoveBookDialog,
      expect.objectContaining({ data: { libraryId: 'l1', book: data.book } }),
    );
    expect(close).toHaveBeenCalledWith('removed');
  });

  it('stays open when the removal is cancelled', async () => {
    const { close, clickButton } = await setup();

    await clickButton('Quitar');

    expect(close).not.toHaveBeenCalled();
  });

  it('does not offer removing the book when opened outside a library', async () => {
    const { element } = await setup({ libraryId: null });

    const labels = Array.from(element.querySelectorAll('mat-dialog-actions button')).map((button) =>
      button.textContent?.trim(),
    );
    expect(labels).toEqual(['Cancelar', 'Guardar']);
  });

  it('still saves the changes when opened outside a library', async () => {
    const update = vi.fn((_id: string, changes: Partial<UserBook>) => of({ ...book, ...changes }));
    const { close, clickButton, typeNotes } = await setup({ libraryId: null, update });

    await typeNotes('Otra nota');
    await clickButton('Guardar');

    expect(update).toHaveBeenCalledWith('ub1', { rating: 8, notes: 'Otra nota' });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Otra nota' }));
  });
});
