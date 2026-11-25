import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { AddToLibraryDialog } from '../../shared-libraries/add-to-library-dialog/add-to-library-dialog';
import { SharedBook, SharedBookDetail, SharedBookPerson } from '../shared-book.model';
import { SharedBooksService } from '../shared-books.service';
import { SharedBookDetailDialog } from './shared-book-detail-dialog';

const book: SharedBook = {
  id: 'b1',
  bookTitle: 'Rossiya',
  bookAuthors: ['Alex Shishin'],
  bookCoverUrl: null,
  bookIsbn13: '9780595385294',
  bookIsbn10: null,
  own: null,
  libraries: [{ id: 'l1', name: 'Viajes', ownerName: 'Ana' }],
};

function person(ownerName: string, changes: Partial<SharedBookPerson> = {}): SharedBookPerson {
  return {
    ownerName,
    sharesRatings: true,
    rating: null,
    libraries: [{ id: `l-${ownerName}`, name: `Biblioteca de ${ownerName}` }],
    ...changes,
  };
}

describe('SharedBookDetailDialog', () => {
  async function setup(
    options: {
      people?: SharedBookPerson[];
      own?: SharedBook['own'];
      get?: ReturnType<typeof vi.fn>;
      addResult?: string;
    } = {},
  ) {
    const { libraries: _, ...data } = book;
    const detail: SharedBookDetail = {
      ...data,
      own: options.own ?? null,
      people: options.people ?? [person('Ana')],
    };
    const get = options.get ?? vi.fn(() => of(detail));
    const close = vi.fn();
    const openDialog = vi.fn(() => ({ afterClosed: () => of(options.addResult) }));
    TestBed.configureTestingModule({
      imports: [SharedBookDetailDialog],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: book },
        { provide: MatDialogRef, useValue: { close } },
        { provide: SharedBooksService, useValue: { get } },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: { open: openDialog } });
    // The links are followed, but there are no routes to go to
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SharedBookDetailDialog);
    const notFound = vi.fn();
    fixture.componentInstance.notFound.subscribe(notFound);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const text = (item: Element) => item.textContent!.replace(/\s+/g, ' ').trim();
    return {
      fixture,
      element,
      get,
      close,
      openDialog,
      notFound,
      people: () =>
        Array.from(element.querySelectorAll('.people > li'), (item) => ({
          name: text(item.querySelector('.name')!),
          rating:
            item.querySelector('app-rating-value')?.getAttribute('aria-label') ??
            item.querySelector('.missing')?.textContent ??
            null,
          libraries: Array.from(item.querySelectorAll('a'), text),
        })),
      button: (label: string) =>
        Array.from(element.querySelectorAll<HTMLElement>('button, a')).find((item) =>
          item.textContent?.includes(label),
        ),
    };
  }

  it('shows everyone who shares the book, and tells a missing rating from a hidden one', async () => {
    const { people, get } = await setup({
      people: [
        person('Ana', {
          rating: 9,
          libraries: [
            { id: 'l1', name: 'Novela' },
            { id: 'l2', name: 'Viajes' },
          ],
        }),
        person('Luis'),
        person('Marta', { sharesRatings: false }),
      ],
    });

    expect(get).toHaveBeenCalledExactlyOnceWith('b1');
    expect(people()).toEqual([
      { name: 'Ana', rating: 'Valoración de Ana: 9 de 10', libraries: ['Novela', 'Viajes'] },
      { name: 'Luis', rating: 'Sin valorar', libraries: ['Biblioteca de Luis'] },
      { name: 'Marta', rating: null, libraries: ['Biblioteca de Marta'] },
    ]);
  });

  it('shows separately two people with the same name', async () => {
    const { people } = await setup({
      people: [person('Ana', { rating: 9 }), person('Ana', { rating: 2 })],
    });

    expect(people().map(({ rating }) => rating)).toEqual([
      'Valoración de Ana: 9 de 10',
      'Valoración de Ana: 2 de 10',
    ]);
  });

  it('links each library to the book in it, and closes', async () => {
    const { element, close } = await setup();
    const link = element.querySelector<HTMLAnchorElement>('.people a')!;

    expect(link.getAttribute('href')).toBe('/libraries/shared/l-Ana?q=9780595385294');
    link.click();
    expect(close).toHaveBeenCalledWith();
  });

  it('folds the people beyond the first five', async () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const { fixture, people, button } = await setup({ people: names.map((name) => person(name)) });
    expect(people()).toHaveLength(5);
    expect(button('+2 más')?.getAttribute('aria-expanded')).toBe('false');

    button('+2 más')!.click();
    await fixture.whenStable();

    expect(people().map(({ name }) => name)).toEqual(names);
    expect(button('Mostrar menos')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not fold exactly five people', async () => {
    const { button, people } = await setup({
      people: ['A', 'B', 'C', 'D', 'E'].map((name) => person(name)),
    });

    expect(people()).toHaveLength(5);
    expect(button('más')).toBeUndefined();
  });

  it('shows the opinion of the user, up to date, with where to edit it', async () => {
    const { element, button, close } = await setup({ own: { rating: 7, notes: 'Releer' } });

    expect(element.querySelector('[aria-label="Tu valoración: 7 de 10"]')).not.toBeNull();
    expect(element.querySelector('.notes')?.textContent).toBe('Releer');
    expect(button('Añadir a mi biblioteca')).toBeUndefined();
    expect(button('Editar en mis libros')?.getAttribute('href')).toBe('/books?q=9780595385294');
    button('Editar en mis libros')!.click();
    expect(close).toHaveBeenCalledWith();
  });

  it('adds a book that the user does not have', async () => {
    const { element, button, openDialog, close } = await setup({ addResult: 'Novela' });
    expect(element.textContent).not.toContain('Mi valoración');
    expect(element.textContent).toContain('No está en ninguna de tus bibliotecas');

    button('Añadir a mi biblioteca')!.click();

    expect(openDialog).toHaveBeenCalledWith(
      AddToLibraryDialog,
      expect.objectContaining({ data: book }),
    );
    expect(close).toHaveBeenCalledWith({ addedTo: 'Novela' });
  });

  it('stays open if adding it is cancelled', async () => {
    const { button, close } = await setup();

    button('Añadir a mi biblioteca')!.click();

    expect(close).not.toHaveBeenCalled();
  });

  it('shows the book while the people are loaded', async () => {
    const { element } = await setup({ get: vi.fn(() => new Subject()) });

    expect(element.textContent).toContain('Alex Shishin');
    expect(element.querySelector('mat-spinner')).not.toBeNull();
  });

  it('tells that nobody shares the book any more', async () => {
    const { element, notFound } = await setup({
      get: vi.fn(() => {
        // As a real response: after the dialog is created
        const response = new Subject();
        setTimeout(() => response.error(new ApiError(404, null, 'shared book not found')));
        return response;
      }),
    });
    await vi.waitFor(() => expect(notFound).toHaveBeenCalledTimes(1));

    TestBed.tick();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'ya no está en ninguna biblioteca compartida contigo',
    );
    expect(element.querySelector('.people')).toBeNull();
  });

  it('lets the user retry after a failure', async () => {
    const { libraries: _, ...data } = book;
    const get = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new ApiError(500, null, '')))
      .mockReturnValue(of({ ...data, people: [person('Ana')] }));
    const { fixture, people, button, notFound } = await setup({ get });

    button('Reintentar')!.click();
    await fixture.whenStable();

    expect(people()).toHaveLength(1);
    expect(notFound).not.toHaveBeenCalled();
  });
});
