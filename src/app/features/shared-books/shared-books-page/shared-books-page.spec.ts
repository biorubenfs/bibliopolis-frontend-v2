import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';

import { SectionCounts } from '../../../core/tabbed-section/section-counts';
import { SharedBook } from '../shared-book.model';
import { SharedBookDetailDialog } from '../shared-book-detail-dialog/shared-book-detail-dialog';
import { SharedBooksService } from '../shared-books.service';
import { SharedBooksPage } from './shared-books-page';

function book(id: string, title: string, changes: Partial<SharedBook> = {}): SharedBook {
  return {
    id,
    bookTitle: title,
    bookAuthors: ['Autora'],
    bookCoverUrl: null,
    bookIsbn13: '9780595385294',
    bookIsbn10: null,
    own: null,
    libraries: [{ id: 'l1', name: 'Viajes', ownerName: 'Ana' }],
    ...changes,
  };
}

const rossiya = book('1', 'Rossiya');
const ulises = book('2', 'Ulises', {
  own: { rating: 7, notes: null },
  libraries: [
    { id: 'l1', name: 'Viajes', ownerName: 'Ana' },
    { id: 'l2', name: 'Clásicos', ownerName: 'Luis' },
  ],
});

describe('SharedBooksPage', () => {
  afterEach(() => localStorage.clear());

  async function setup(
    options: { url?: string; list?: ReturnType<typeof vi.fn>; dialogResult?: unknown } = {},
  ) {
    const list = options.list ?? vi.fn(() => of({ items: [rossiya, ulises], total: 2 }));
    const notFound = new Subject<void>();
    const openDialog = vi.fn(() => ({
      componentInstance: { notFound },
      afterClosed: () => of(options.dialogResult),
    }));
    const openSnackBar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'books/shared', component: SharedBooksPage }]),
        SectionCounts,
        { provide: SharedBooksService, useValue: { list } },
        { provide: MatDialog, useValue: { open: openDialog } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
      ],
    });
    const harness = await RouterTestingHarness.create(options.url ?? '/books/shared');
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement as HTMLElement;
    return {
      harness,
      element,
      list,
      notFound,
      openDialog,
      openSnackBar,
      counts: TestBed.inject(SectionCounts),
      open: async (index: number) => {
        element.querySelectorAll<HTMLButtonElement>('button.open')[index].click();
        await harness.fixture.whenStable();
      },
    };
  }

  it('shows where each book is, the rating of the user and whether they have it', async () => {
    const { element, list, counts } = await setup();

    expect(list).toHaveBeenCalledExactlyOnceWith({ skip: 0, limit: 12, search: '' });
    expect(counts.shared()).toBe(2);
    const [first, second] = Array.from(element.querySelectorAll('app-user-book-card'));
    expect(first.querySelector('.libraries')?.textContent).toContain('Viajes, de Ana');
    expect(first.textContent).not.toContain('Lo tienes');
    expect(first.querySelector('app-rating-value')).toBeNull();
    expect(second.querySelector('.libraries')?.textContent).toContain('Viajes, de Ana, y 1 más');
    expect(second.textContent).toContain('Lo tienes');
    expect(second.querySelector('app-rating-value')?.getAttribute('aria-label')).toBe(
      'Tu valoración: 7 de 10',
    );
    expect(element.querySelector('[aria-label^="Quitar"]')).toBeNull();
  });

  it('shows the same in a table', async () => {
    localStorage.setItem('bibliopolis.booksView', 'table');
    const { element } = await setup();

    const headers = Array.from(element.querySelectorAll('th'), (th) => th.textContent?.trim());
    expect(headers).toEqual(['Título', 'Autores', 'Tú', 'Bibliotecas', 'ISBN-13', 'ISBN-10']);
    const [first, second] = Array.from(element.querySelectorAll('tbody tr'));
    expect(first.textContent).toContain('1 biblioteca');
    expect(first.textContent).not.toContain('lo tienes');
    expect(second.textContent).toContain('2 bibliotecas');
    expect(second.textContent).toContain('lo tienes');
  });

  it('explains that nothing is shared yet', async () => {
    const { element, counts } = await setup({ list: vi.fn(() => of({ items: [], total: 0 })) });

    expect(element.textContent).toContain('Aún no hay libros compartidos contigo');
    expect(element.querySelector('input')).toBeNull();
    expect(counts.shared()).toBe(0);
  });

  it('offers the own books when none matches the search', async () => {
    const { harness, element, counts } = await setup({
      url: '/books/shared?q=poes%C3%ADa',
      list: vi.fn(({ search }: { search: string }) =>
        of(search ? { items: [], total: 0 } : { items: [rossiya], total: 1 }),
      ),
    });
    const link = () => element.querySelector('.status a');
    expect(element.textContent).toContain('coincide con «poesía»');
    expect(link()).toBeNull();

    counts.own.set(3);
    await harness.fixture.whenStable();
    expect(link()?.textContent?.trim()).toBe('Ver 3 en mis libros');
    expect(link()?.getAttribute('href')).toBe('/books?q=poes%C3%ADa');

    element.querySelector<HTMLButtonElement>('.status button')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/books/shared');
    expect(element.querySelectorAll('app-user-book-card')).toHaveLength(1);
  });

  it('lets the user retry after a failure', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error()))
      .mockReturnValue(of({ items: [rossiya], total: 1 }));
    const { harness, element, counts } = await setup({ list });
    expect(counts.shared()).toBeNull();

    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await harness.fixture.whenStable();

    expect(element.querySelectorAll('app-user-book-card')).toHaveLength(1);
  });

  describe('detail', () => {
    it('opens the book as the API returned it, and nothing else happens if it is closed', async () => {
      const { open, openDialog, list, openSnackBar } = await setup();

      await open(1);

      expect(openDialog).toHaveBeenCalledWith(
        SharedBookDetailDialog,
        expect.objectContaining({ data: ulises }),
      );
      expect(list).toHaveBeenCalledTimes(1);
      expect(openSnackBar).not.toHaveBeenCalled();
    });

    it('reloads the list and counts the own books again after adding one', async () => {
      const { open, list, openSnackBar, counts } = await setup({
        dialogResult: { addedTo: 'Novela' },
      });
      const recounted = vi.fn();
      counts.recounts$.subscribe(recounted);

      await open(0);

      expect(openSnackBar.mock.calls[0][0]).toBe('«Rossiya» añadido a «Novela»');
      expect(list).toHaveBeenCalledTimes(2);
      expect(recounted).toHaveBeenCalledTimes(1);
    });

    it('reloads the list if nobody shares the book any more', async () => {
      const { open, list, notFound } = await setup();
      await open(0);

      notFound.next();

      expect(list).toHaveBeenCalledTimes(2);
    });
  });
});
