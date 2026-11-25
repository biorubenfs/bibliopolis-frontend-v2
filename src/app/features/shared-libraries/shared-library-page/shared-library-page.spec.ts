import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { SharedBookDialog } from '../shared-book-dialog/shared-book-dialog';
import { SharedLibrariesService } from '../shared-libraries.service';
import { SharedLibrary, SharedLibraryBook } from '../shared-library.model';
import { SharedLibraryPage } from './shared-library-page';

const library: SharedLibrary = {
  id: 'l1',
  name: 'Novela',
  description: 'Sus novelas',
  ownerName: 'Ana',
  booksCount: 2,
  shareRatings: true,
  sharedAt: '',
};

function book(id: string, changes: Partial<SharedLibraryBook> = {}): SharedLibraryBook {
  return {
    id,
    bookTitle: `Libro ${id}`,
    bookAuthors: ['Autora'],
    bookCoverUrl: null,
    bookIsbn13: '9780595385294',
    bookIsbn10: null,
    ownerRating: 9,
    own: { rating: 7, notes: null },
    ...changes,
  };
}

const notFound = () => throwError(() => new ApiError(404, 'NOT FOUND ERROR', 'library not found'));

describe('SharedLibraryPage', () => {
  afterEach(() => localStorage.clear());

  async function setup(
    options: {
      url?: string;
      library?: Partial<SharedLibrary>;
      get?: ReturnType<typeof vi.fn>;
      listBooks?: ReturnType<typeof vi.fn>;
      dialogResult?: unknown;
    } = {},
  ) {
    const get = options.get ?? vi.fn((id: string) => of({ ...library, ...options.library, id }));
    const listBooks =
      options.listBooks ??
      vi.fn(() =>
        of({ items: [book('b1'), book('b2', { ownerRating: null, own: null })], total: 2 }),
      );
    const openDialog = vi.fn(() => ({ afterClosed: () => of(options.dialogResult) }));
    const openSnackBar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        // Real routing: the page receives :id through input binding
        provideRouter(
          [{ path: 'shared-libraries/:id', component: SharedLibraryPage }],
          withComponentInputBinding(),
        ),
        { provide: SharedLibrariesService, useValue: { get, listBooks } },
        { provide: MatDialog, useValue: { open: openDialog } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
      ],
    });
    const harness = await RouterTestingHarness.create(options.url ?? '/shared-libraries/l1');
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement as HTMLElement;
    const ratings = (selector: string) =>
      Array.from(element.querySelectorAll(`${selector} app-rating-value`), (item) =>
        item.getAttribute('aria-label'),
      );
    return { harness, element, get, listBooks, openDialog, openSnackBar, ratings };
  }

  it('shows the library with its owner and its books', async () => {
    const { element, get, listBooks } = await setup();

    expect(get).toHaveBeenCalledWith('l1');
    expect(listBooks).toHaveBeenCalledWith('l1', { skip: 0, limit: 12, search: '' });
    expect(element.querySelector('h1')?.textContent).toBe('Novela');
    expect(element.querySelector('.owner')?.textContent).toBe('De Ana');
    expect(element.querySelector('.description')?.textContent).toContain('Sus novelas');
    expect(element.querySelector('.count')?.textContent).toBe('2 libros');
    expect(element.querySelectorAll('app-user-book-card')).toHaveLength(2);
    expect(element.querySelector('a.back')?.getAttribute('href')).toBe('/shared-libraries');
  });

  it('offers nothing that only the owner can do', async () => {
    const { element } = await setup();

    expect(element.querySelector('[aria-label^="Quitar"]')).toBeNull();
    expect(element.textContent).not.toMatch(/Añadir libro|Importar|Compartir\b|Descargar/);
  });

  it('shows the ratings of both, only those there are', async () => {
    const { ratings } = await setup();

    expect(ratings('li:nth-child(1)')).toEqual([
      'Valoración de Ana: 9 de 10',
      'Tu valoración: 7 de 10',
    ]);
    expect(ratings('li:nth-child(2)')).toEqual([]);
  });

  it('shows only the own ratings when the owner does not share theirs', async () => {
    const { ratings } = await setup({
      library: { shareRatings: false },
      listBooks: vi.fn(() => of({ items: [book('b1', { ownerRating: null })], total: 1 })),
    });

    expect(ratings('li')).toEqual(['Tu valoración: 7 de 10']);
  });

  it('shows the same ratings in the table', async () => {
    localStorage.setItem('bibliopolis.booksView', 'table');
    const { element, ratings } = await setup();

    const headers = Array.from(element.querySelectorAll('th'), (th) => th.textContent!.trim());
    expect(headers).toEqual([
      'Título',
      'Autores',
      'Ana',
      'Tú',
      'Valoraciones',
      'ISBN-13',
      'ISBN-10',
    ]);
    expect(ratings('tbody tr:nth-child(1) .rater')).toEqual([
      'Valoración de Ana: 9 de 10',
      'Tu valoración: 7 de 10',
    ]);
  });

  it('searches and pages with the URL', async () => {
    const { listBooks } = await setup({
      url: '/shared-libraries/l1?q=ros&page=2',
      listBooks: vi.fn(() => of({ items: [book('b1')], total: 13 })),
    });

    expect(listBooks).toHaveBeenCalledWith('l1', { skip: 12, limit: 12, search: 'ros' });
  });

  it('explains that there are no results or no books', async () => {
    const empty = vi.fn(() => of({ items: [], total: 0 }));
    const searched = await setup({ url: '/shared-libraries/l1?q=nada', listBooks: empty });
    expect(searched.element.textContent).toContain('coincide con «nada»');

    TestBed.resetTestingModule();
    const { element } = await setup({ listBooks: empty });
    expect(element.textContent).toContain('Esta biblioteca aún no tiene libros');
    expect(element.textContent).toContain('Cuando Ana añada alguno');
  });

  it('says that a library without access was not found', async () => {
    const { element } = await setup({ get: vi.fn(notFound), listBooks: vi.fn(notFound) });

    expect(element.textContent).toContain('No hemos encontrado esta biblioteca');
    expect(element.querySelector('[role="alert"] button')).toBeNull();
    expect(element.querySelector('mat-paginator')).toBeNull();
  });

  it('leaves nothing of the library on screen when the access is lost with the page open', async () => {
    const get = vi.fn().mockReturnValueOnce(of(library)).mockImplementation(notFound);
    const { harness, element } = await setup({ get });
    expect(element.querySelector('h1')?.textContent).toBe('Novela');

    await harness.navigateByUrl('/shared-libraries/l1?page=2');
    await harness.fixture.whenStable();

    expect(element.textContent).toContain('No hemos encontrado esta biblioteca');
    expect(element.textContent).not.toContain('Novela');
    expect(element.textContent).not.toContain('Libro b1');
    expect(element.querySelector('input')).toBeNull();
    expect(element.querySelector('app-books-view-toggle')).toBeNull();
  });

  it('lets the user retry any other failure', async () => {
    const listBooks = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new ApiError(500, null, '')))
      .mockReturnValue(of({ items: [book('b1')], total: 1 }));
    const { harness, element } = await setup({ listBooks });
    expect(element.textContent).not.toContain('No hemos encontrado');

    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await harness.fixture.whenStable();

    expect(element.querySelectorAll('app-user-book-card')).toHaveLength(1);
  });

  it('loads the other library when the route changes to it', async () => {
    const { harness, element, get, listBooks } = await setup({
      get: vi.fn((id: string) => of({ ...library, id, name: `Biblioteca ${id}` })),
    });

    await harness.navigateByUrl('/shared-libraries/l2');
    await harness.fixture.whenStable();

    expect(get).toHaveBeenLastCalledWith('l2');
    expect(listBooks).toHaveBeenLastCalledWith('l2', { skip: 0, limit: 12, search: '' });
    expect(element.querySelector('h1')?.textContent).toBe('Biblioteca l2');
  });

  describe('book detail', () => {
    async function open(dialogResult?: unknown) {
      const result = await setup({ dialogResult });
      result.element.querySelector<HTMLButtonElement>('app-user-book-card button.open')!.click();
      await result.harness.fixture.whenStable();
      return result;
    }

    it('opens in read-only', async () => {
      const { openDialog, listBooks, openSnackBar } = await open();

      expect(openDialog).toHaveBeenCalledWith(
        SharedBookDialog,
        expect.objectContaining({
          data: { library, book: expect.objectContaining(book('b1')) },
        }),
      );
      expect(listBooks).toHaveBeenCalledTimes(1);
      expect(openSnackBar).not.toHaveBeenCalled();
    });

    it('reloads the books after adding one to an own library', async () => {
      const { listBooks, openSnackBar } = await open({ addedTo: 'Pendientes' });

      expect(openSnackBar.mock.calls[0][0]).toBe('«Libro b1» añadido a «Pendientes»');
      expect(listBooks).toHaveBeenCalledTimes(2);
    });
  });
});
