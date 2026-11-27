import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AddToLibrariesDialog } from '../../libraries/add-to-libraries-dialog/add-to-libraries-dialog';
import { SharedLibraryBook } from '../shared-library.model';
import { SharedBookDialog } from './shared-book-dialog';

describe('SharedBookDialog', () => {
  const book: SharedLibraryBook = {
    id: 'b1',
    bookTitle: 'Rossiya',
    bookAuthors: ['Alex Shishin'],
    bookCoverUrl: null,
    bookIsbn13: '9780595385294',
    bookIsbn10: '059538529X',
    ownerRating: 9,
    own: { rating: 7, notes: 'Releer' },
  };

  async function setup(
    changes: Partial<SharedLibraryBook> = {},
    options: { shareRatings?: boolean; addResult?: { id: string; name: string }[] } = {},
  ) {
    const close = vi.fn();
    const open = vi.fn(() => ({ afterClosed: () => of(options.addResult) }));
    const data = {
      library: {
        id: 'l1',
        name: 'Novela',
        ownerName: 'Ana',
        shareRatings: options.shareRatings ?? true,
      },
      book: { ...book, ...changes },
    };
    // MatDialogModule brings its own MatDialog, which a plain provider would not replace
    TestBed.overrideProvider(MatDialog, { useValue: { open } });
    TestBed.configureTestingModule({
      imports: [SharedBookDialog],
      providers: [
        provideRouter([{ path: 'books', children: [] }]),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const fixture = TestBed.createComponent(SharedBookDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const ratings = Array.from(element.querySelectorAll('.ratings > div'), (row) => [
      row.querySelector('dt')!.textContent,
      row.querySelector('app-rating-value')?.getAttribute('aria-label') ??
        row.querySelector('dd')!.textContent!.trim(),
    ]);
    const button = (label: string) =>
      Array.from(element.querySelectorAll<HTMLElement>('mat-dialog-actions a, button')).find(
        (item) => item.textContent?.includes(label),
      );
    return { element, ratings, button, open, close, data };
  }

  it('shows an own book with both ratings and the own notes, and links to edit it', async () => {
    const { element, ratings, button } = await setup();

    expect(element.querySelector('h2')?.textContent).toContain('Rossiya');
    expect(element.textContent).toContain('Alex Shishin');
    expect(element.textContent).toContain('ISBN-10: 059538529X');
    expect(ratings).toEqual([
      ['Ana', 'Valoración de Ana: 9 de 10'],
      ['Tú', 'Tu valoración: 7 de 10'],
    ]);
    expect(element.querySelector('.notes')?.textContent).toBe('Releer');
    expect(button('Editar en Mis libros')?.getAttribute('href')).toBe('/books?q=9780595385294');
    expect(button('Añadir a mi biblioteca')).toBeUndefined();
  });

  it('has nothing to edit in place', async () => {
    const { element } = await setup();

    expect(element.querySelector('input, textarea, app-rating-input')).toBeNull();
  });

  it('says what is not rated', async () => {
    const { element, ratings } = await setup({
      ownerRating: null,
      own: { rating: null, notes: null },
    });

    expect(ratings).toEqual([
      ['Ana', 'Sin valorar'],
      ['Tú', 'Sin valorar'],
    ]);
    expect(element.querySelector('.notes')).toBeNull();
  });

  it('only shows the rating of the owner for a book the user does not have', async () => {
    const { element, ratings, button } = await setup({ own: null });

    expect(ratings).toEqual([['Ana', 'Valoración de Ana: 9 de 10']]);
    expect(element.textContent).toContain('No está en ninguna de tus bibliotecas');
    expect(button('Añadir a mi biblioteca')).toBeDefined();
    expect(button('Editar en Mis libros')).toBeUndefined();
  });

  it('only shows the own rating when the owner does not share theirs', async () => {
    const { element, ratings } = await setup({ ownerRating: null }, { shareRatings: false });

    expect(ratings).toEqual([['Tú', 'Tu valoración: 7 de 10']]);
    expect(element.textContent).not.toContain('Ana');
  });

  it('shows no ratings when there are none to show', async () => {
    const { element } = await setup({ ownerRating: null, own: null }, { shareRatings: false });

    expect(element.textContent).not.toContain('Valoraciones');
  });

  it('closes when following the link', async () => {
    const { button, close } = await setup();

    button('Editar en Mis libros')!.click();

    expect(close).toHaveBeenCalled();
  });

  it('closes with the library the book was added to', async () => {
    const { button, open, close, data } = await setup(
      { own: null },
      { addResult: [{ id: 'l2', name: 'Pendientes' }] },
    );

    button('Añadir a mi biblioteca')!.click();

    expect(open).toHaveBeenCalledWith(
      AddToLibrariesDialog,
      expect.objectContaining({
        data: {
          title: data.book.bookTitle,
          isbn13: data.book.bookIsbn13,
          isbn10: data.book.bookIsbn10,
          authors: data.book.bookAuthors,
        },
      }),
    );
    expect(close).toHaveBeenCalledWith({ addedTo: [{ id: 'l2', name: 'Pendientes' }] });
  });

  it('stays open if the book was not added', async () => {
    const { button, close } = await setup({ own: null });

    button('Añadir a mi biblioteca')!.click();

    expect(close).not.toHaveBeenCalled();
  });
});
