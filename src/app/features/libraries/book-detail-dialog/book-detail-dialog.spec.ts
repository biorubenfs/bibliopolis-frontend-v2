import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { UserBook } from '../../user-books/user-book.model';
import { UserBooksService } from '../../user-books/user-books.service';
import { LibrariesService } from '../libraries.service';
import { AddToLibrariesDialog } from '../add-to-libraries-dialog/add-to-libraries-dialog';
import { RemoveBookDialog } from '../remove-book-dialog/remove-book-dialog';
import { BookDetailDialog, localDay } from './book-detail-dialog';

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
  readingStatus: null,
  finishedAt: null,
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
      addResult?: { id: string; name: string }[];
      update?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    const close = vi.fn();
    const open = vi.fn(() => ({
      afterClosed: () => of(options.addResult ?? options.removeResult),
    }));
    const update =
      options.update ??
      vi.fn((_id: string, changes: Partial<UserBook>) => of({ ...book, ...changes }));
    const libraryId = options.libraryId === undefined ? 'l1' : (options.libraryId ?? undefined);
    const data = { libraryId, book: { ...book, ...options.overrides } };
    // MatDialogModule brings its own MatDialog, which a plain provider would not replace
    TestBed.overrideProvider(MatDialog, { useValue: { open } });
    const libraries = [
      { id: 'l1', name: 'Novela' },
      { id: 'l2', name: 'Préstamos' },
    ];
    const list = vi.fn(() => of({ items: libraries, total: libraries.length }));
    TestBed.configureTestingModule({
      imports: [BookDetailDialog],
      providers: [
        // A matching route keeps a clicked link from failing to navigate after the test ends
        provideRouter([{ path: 'libraries/:id', children: [] }]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
        { provide: UserBooksService, useValue: { update } },
        { provide: LibrariesService, useValue: { list } },
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
      list,
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

  it('shows the libraries of the book, marking the one it is viewed from', async () => {
    const { fixture, element, list, close } = await setup({
      overrides: { libraries: ['l1', 'l2'] },
    });

    expect(list).toHaveBeenCalledWith({ skip: 0, limit: 100, ids: ['l1', 'l2'] });
    const chips = Array.from(element.querySelectorAll<HTMLElement>('app-book-libraries .chip'));
    expect(chips.map((chip) => chip.querySelector('.name')?.textContent)).toEqual([
      'Novela',
      'Préstamos',
    ]);
    expect(chips[0].tagName).toBe('SPAN');
    expect(chips[1].getAttribute('href')).toBe('/libraries/l2');

    chips[1].click();
    await fixture.whenStable();
    expect(close).toHaveBeenCalledWith();
  });

  it('links every library when opened outside any of them', async () => {
    const { element } = await setup({ libraryId: null, overrides: { libraries: ['l1', 'l2'] } });

    const links = element.querySelectorAll('app-book-libraries a.chip');
    expect(links.length).toBe(2);
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

    expect(update).toHaveBeenCalledWith('ub1', {
      rating: 9,
      notes: 'Otra nota',
      readingStatus: null,
      finishedAt: null,
    });
    expect(close).toHaveBeenCalledWith(updated);
  });

  it('can clear the rating', async () => {
    const { update, clickButton, chooseRating } = await setup();

    // Clicking on the current rating clears it
    await chooseRating(8);
    await clickButton('Guardar');

    expect(update).toHaveBeenCalledWith('ub1', {
      rating: null,
      notes: 'Muy recomendable',
      readingStatus: null,
      finishedAt: null,
    });
  });

  it('sends null when the notes are emptied', async () => {
    const { update, clickButton, typeNotes } = await setup();

    await typeNotes('   ');
    await clickButton('Guardar');

    expect(update).toHaveBeenCalledWith('ub1', {
      rating: 8,
      notes: null,
      readingStatus: null,
      finishedAt: null,
    });
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

  it('adds the book to other libraries right away, showing them and telling the page', async () => {
    const added = [{ id: 'l2', name: 'Préstamos' }];
    const { fixture, open, list, close, clickButton } = await setup({ addResult: added });
    const librariesAdded = vi.fn();
    fixture.componentInstance.librariesAdded.subscribe(librariesAdded);

    await clickButton('Añadir a otra biblioteca');

    expect(open).toHaveBeenCalledWith(
      AddToLibrariesDialog,
      expect.objectContaining({
        data: {
          title: 'Rossiya',
          isbn13: '9780595385294',
          isbn10: '059538529X',
          authors: ['Alex Shishin', 'Otra Autora'],
        },
      }),
    );
    expect(librariesAdded).toHaveBeenCalledWith(added);
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ ids: ['l1', 'l2'] }));
    expect(close).not.toHaveBeenCalled();
  });

  it('changes nothing when no library is added', async () => {
    const { fixture, list, clickButton } = await setup();
    const librariesAdded = vi.fn();
    fixture.componentInstance.librariesAdded.subscribe(librariesAdded);

    await clickButton('Añadir a otra biblioteca');

    expect(librariesAdded).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(1);
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

    expect(update).toHaveBeenCalledWith('ub1', {
      rating: 8,
      notes: 'Otra nota',
      readingStatus: null,
      finishedAt: null,
    });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Otra nota' }));
  });

  describe('reading status', () => {
    const statusButton = (element: HTMLElement, label: string) =>
      Array.from(
        element.querySelectorAll<HTMLButtonElement>('app-reading-status-input button'),
      ).find((button) => button.textContent?.includes(label))!;
    const dateInput = (element: HTMLElement) =>
      element.querySelector<HTMLInputElement>('input[type="date"]');

    it('shows the current status pressed, and the date only for a read book', async () => {
      const reading = await setup({ overrides: { readingStatus: 'reading' } });

      expect(statusButton(reading.element, 'Leyendo').getAttribute('aria-pressed')).toBe('true');
      expect(statusButton(reading.element, 'Leído').getAttribute('aria-pressed')).toBe('false');
      expect(dateInput(reading.element)).toBeNull();
    });

    it('shows «Sin estado» for a book without status', async () => {
      const { element } = await setup();

      expect(element.querySelector('app-reading-status-input')?.textContent).toContain(
        'Sin estado',
      );
    });

    it('suggests today when marking a book as read, and saves it', async () => {
      const { element, update, clickButton } = await setup();

      statusButton(element, 'Leído').click();
      await clickButton('Guardar');

      expect(update).toHaveBeenCalledWith('ub1', {
        rating: 8,
        notes: 'Muy recomendable',
        readingStatus: 'read',
        finishedAt: localDay(),
      });
    });

    it('saves a read book without date when the date is emptied', async () => {
      const { element, fixture, update, clickButton } = await setup();

      statusButton(element, 'Leído').click();
      await fixture.whenStable();
      const input = dateInput(element)!;
      input.value = '';
      input.dispatchEvent(new Event('input'));
      await clickButton('Guardar');

      expect(update).toHaveBeenCalledWith(
        'ub1',
        expect.objectContaining({ readingStatus: 'read', finishedAt: null }),
      );
    });

    it('clears the date when a read book goes back to another status', async () => {
      const { element, fixture, update, clickButton } = await setup({
        overrides: { readingStatus: 'read', finishedAt: '2026-03-14' },
      });
      expect(dateInput(element)?.value).toBe('2026-03-14');

      statusButton(element, 'Pendiente').click();
      await fixture.whenStable();
      expect(dateInput(element)).toBeNull();
      await clickButton('Guardar');

      expect(update).toHaveBeenCalledWith(
        'ub1',
        expect.objectContaining({ readingStatus: 'to_read', finishedAt: null }),
      );
    });

    it('gets the date back when a mistake is undone before saving', async () => {
      const { element, fixture } = await setup({
        overrides: { readingStatus: 'read', finishedAt: '2026-03-14' },
      });

      statusButton(element, 'Pendiente').click();
      await fixture.whenStable();
      statusButton(element, 'Leído').click();
      await fixture.whenStable();

      expect(dateInput(element)?.value).toBe('2026-03-14');
    });

    it('clears the status when clicking on the current one', async () => {
      const { element, update, clickButton } = await setup({
        overrides: { readingStatus: 'read', finishedAt: '2026-03-14' },
      });

      statusButton(element, 'Leído').click();
      await clickButton('Guardar');

      expect(update).toHaveBeenCalledWith(
        'ub1',
        expect.objectContaining({ readingStatus: null, finishedAt: null }),
      );
    });

    it('does not save a date in the future', async () => {
      const { element, fixture, update, close, clickButton } = await setup({
        overrides: { readingStatus: 'read', finishedAt: null },
      });

      const input = dateInput(element)!;
      input.value = '2999-01-01';
      input.dispatchEvent(new Event('input'));
      await clickButton('Guardar');
      fixture.detectChanges();

      expect(update).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
      expect(element.querySelector('mat-error')?.textContent).toContain(
        'No puede ser posterior a hoy',
      );
    });
  });
});
