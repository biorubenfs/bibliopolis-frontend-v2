import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { SEARCH_DEBOUNCE_MS } from '../../../core/lists/searchable-list';
import { ImportCsvDialog } from '../../imports/import-csv-dialog/import-csv-dialog';
import { LibraryImport } from '../../imports/import.model';
import { ImportsService } from '../../imports/imports.service';
import { UserBook } from '../../user-books/user-book.model';
import { UserBooksService } from '../../user-books/user-books.service';
import { AddBookDialog } from '../add-book-dialog/add-book-dialog';
import { BookDetailDialog } from '../book-detail-dialog/book-detail-dialog';
import { LibrariesService } from '../libraries.service';
import { Library } from '../library.model';
import { RemoveBookDialog } from '../remove-book-dialog/remove-book-dialog';
import { ScanBooksDialog } from '../scan-books-dialog/scan-books-dialog';
import { Tag } from '../../tags/tag.model';
import { TagsService } from '../../tags/tags.service';
import { LibraryDetailPage } from './library-detail-page';

const library: Library = {
  id: 'l1',
  name: 'Novela',
  description: 'Mis novelas',
  books: [],
  isFavorite: false,
  tagIds: [],
  userId: 'u1',
  createdAt: '',
  updatedAt: '',
};

function book(id: string, title: string): UserBook {
  return {
    id,
    libraries: ['l1'],
    bookId: `b-${id}`,
    bookTitle: title,
    bookAuthors: ['Autora'],
    bookCoverUrl: null,
    bookIsbn13: '9780595385294',
    bookIsbn10: null,
    rating: null,
    notes: null,
    userId: 'u1',
    createdAt: '',
    updatedAt: '',
  };
}

/** A library with 13 books: one page of 12 and a second page with the last one. */
const thirteenBooks = () =>
  vi.fn((_id: string, { skip }: { skip: number }) =>
    of({ items: skip < 13 ? [book(`${skip}`, `Libro ${skip}`)] : [], total: 13 }),
  );

describe('LibraryDetailPage', () => {
  afterEach(() => localStorage.clear());

  async function setup(
    options: {
      url?: string;
      get?: ReturnType<typeof vi.fn>;
      update?: ReturnType<typeof vi.fn>;
      tags?: Tag[];
      listByLibrary?: ReturnType<typeof vi.fn>;
      listImports?: ReturnType<typeof vi.fn>;
      dialogResult?: unknown;
      touchDevice?: boolean;
    } = {},
  ) {
    const get = options.get ?? vi.fn(() => of(library));
    const update =
      options.update ??
      vi.fn((_id: string, changes: Partial<Library>) => of({ ...library, ...changes }));
    const listByLibrary = options.listByLibrary ?? vi.fn(() => of({ items: [], total: 0 }));
    const listImports = options.listImports ?? vi.fn(() => of({ items: [], total: 0 }));
    const openDialog = vi.fn(() => ({ afterClosed: () => of(options.dialogResult) }));
    const openSnackBar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        // Real routing: the page receives :id, ?page= and ?limit= through input binding
        provideRouter(
          [{ path: 'libraries/:id', component: LibraryDetailPage }],
          withComponentInputBinding(),
        ),
        { provide: LibrariesService, useValue: { get, update } },
        { provide: TagsService, useValue: { listAll: () => of(options.tags ?? []) } },
        { provide: UserBooksService, useValue: { listByLibrary } },
        { provide: ImportsService, useValue: { listByLibrary: listImports } },
        { provide: MatDialog, useValue: { open: openDialog } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: options.touchDevice ?? false }) },
        },
      ],
    });
    const harness = await RouterTestingHarness.create(options.url ?? '/libraries/l1');
    await harness.fixture.whenStable();
    return {
      harness,
      router: TestBed.inject(Router),
      element: harness.routeNativeElement as HTMLElement,
      get,
      update,
      listByLibrary,
      listImports,
      openDialog,
      openSnackBar,
    };
  }

  describe('imports', () => {
    function latestImport(changes: Partial<LibraryImport> = {}, pending = 0): LibraryImport {
      return {
        id: 'i1',
        userId: 'u1',
        libraryId: 'l1',
        fileName: 'libros.csv',
        status: 'completed',
        createdAt: '',
        updatedAt: '',
        finishedAt: '',
        counts: { pending } as LibraryImport['counts'],
        ...changes,
      };
    }
    const listing = (item: LibraryImport) => vi.fn(() => of({ items: [item], total: 1 }));
    const notice = (element: HTMLElement) => element.querySelector('.import-notice');

    it('opens the import dialog with this library as the destination', async () => {
      const { element, openDialog } = await setup();

      Array.from(element.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Importar CSV'))!
        .click();

      expect(openDialog).toHaveBeenCalledWith(
        ImportCsvDialog,
        expect.objectContaining({ data: { library } }),
      );
    });

    it('shows nothing without imports', async () => {
      const { element, listImports } = await setup();

      expect(listImports).toHaveBeenCalledWith('l1', { skip: 0, limit: 1 });
      expect(notice(element)).toBeNull();
    });

    it('still shows the library if the imports cannot be loaded', async () => {
      const { element } = await setup({
        listImports: vi.fn(() => throwError(() => new ApiError(500, null, 'error'))),
      });

      expect(element.querySelector('h1')?.textContent).toContain('Novela');
      expect(notice(element)).toBeNull();
    });

    it('warns about an import in progress and links to it', async () => {
      const { element } = await setup({
        listImports: listing(latestImport({ status: 'running', finishedAt: null })),
      });

      expect(notice(element)?.textContent).toContain('en curso');
      expect(notice(element)?.querySelector('a')?.getAttribute('href')).toBe(
        '/libraries/l1/imports/i1',
      );
    });

    it('warns about pending rows', async () => {
      const { element } = await setup({ listImports: listing(latestImport({}, 3)) });

      expect(notice(element)?.textContent).toContain('3');
      expect(notice(element)?.textContent).toContain('filas pendientes');
      expect(notice(element)?.classList).toContain('attention');
    });

    it('keeps a discreet link to a report without pending rows', async () => {
      const { element } = await setup({ listImports: listing(latestImport()) });

      expect(notice(element)?.textContent).toContain('Ver el informe de la última importación');
      expect(notice(element)?.classList).not.toContain('attention');
    });

    it('reloads the notice after adding a book, which may resolve a pending row', async () => {
      const { element, listImports } = await setup({ dialogResult: 'Rossiya' });
      listImports.mockClear();

      Array.from(element.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Añadir libro'))!
        .click();

      expect(listImports).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the library and its books', async () => {
    const { element, get, listByLibrary } = await setup({
      listByLibrary: vi.fn(() =>
        of({ items: [book('1', 'Rossiya'), book('2', 'Ulises')], total: 2 }),
      ),
    });

    expect(get).toHaveBeenCalledWith('l1');
    expect(listByLibrary).toHaveBeenCalledWith('l1', { skip: 0, limit: 12, search: '' });
    expect(element.querySelector('h1')?.textContent).toContain('Novela');
    expect(element.textContent).toContain('Mis novelas');
    expect(element.querySelector('.description')?.textContent?.trim()).toMatch(
      /^Mis novelas\s+–\s+2 libros$/,
    );
    const cards = element.querySelectorAll('app-user-book-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Rossiya');
    expect(element.querySelector('mat-paginator')).toBeNull();
    expect(element.querySelector('a.back')?.getAttribute('href')).toBe('/libraries');
  });

  describe('table view', () => {
    const books = () => of({ items: [book('1', 'Rossiya'), book('2', 'Ulises')], total: 2 });

    it('switches to a table, remembering the choice', async () => {
      const { harness, element } = await setup({ listByLibrary: vi.fn(books) });

      expect(element.querySelector('.page-header app-books-view-toggle')).not.toBeNull();

      element.querySelector<HTMLButtonElement>('button[aria-label="Ver como tabla"]')!.click();
      await harness.fixture.whenStable();

      expect(element.querySelector('app-user-book-card')).toBeNull();
      expect(element.querySelectorAll('app-user-books-table tbody tr').length).toBe(2);
      expect(localStorage.getItem('bibliopolis.booksView')).toBe('table');
    });

    it('opens the detail and removes books from the table', async () => {
      localStorage.setItem('bibliopolis.booksView', 'table');
      const { harness, element, openDialog } = await setup({ listByLibrary: vi.fn(books) });
      const rossiya = book('1', 'Rossiya');

      element.querySelector<HTMLButtonElement>('app-user-books-table button.open')!.click();
      await harness.fixture.whenStable();
      expect(openDialog).toHaveBeenLastCalledWith(
        BookDetailDialog,
        expect.objectContaining({ data: { libraryId: 'l1', book: rossiya } }),
      );

      element
        .querySelector<HTMLButtonElement>('app-user-books-table [aria-label^="Quitar"]')!
        .click();
      await harness.fixture.whenStable();
      expect(openDialog).toHaveBeenLastCalledWith(
        RemoveBookDialog,
        expect.objectContaining({ data: { libraryId: 'l1', book: rossiya } }),
      );
    });
  });

  describe('scanning books', () => {
    const scanButton = (element: HTMLElement) =>
      Array.from(element.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Escanear libros'),
      );

    it('is not offered on a desktop', async () => {
      const { element } = await setup({ touchDevice: false });

      expect(scanButton(element)).toBeUndefined();
    });

    it('opens the scanner on a touch device', async () => {
      const { element, openDialog } = await setup({ touchDevice: true });

      scanButton(element)!.click();

      expect(openDialog).toHaveBeenCalledWith(
        ScanBooksDialog,
        expect.objectContaining({ data: { libraryId: 'l1' }, disableClose: true }),
      );
    });

    it('reloads the books when some were added', async () => {
      const { element, listByLibrary } = await setup({ touchDevice: true, dialogResult: 2 });
      listByLibrary.mockClear();

      scanButton(element)!.click();

      expect(listByLibrary).toHaveBeenCalledTimes(1);
    });

    it('does not reload when nothing changed', async () => {
      const { element, listByLibrary } = await setup({ touchDevice: true, dialogResult: 0 });
      listByLibrary.mockClear();

      scanButton(element)!.click();

      expect(listByLibrary).not.toHaveBeenCalled();
    });
  });

  it('shows the tags of the library and skips unknown ones', async () => {
    const tag = (id: string, name: string): Tag => ({
      id,
      name,
      color: 'blue',
      userId: 'u1',
      createdAt: '',
      updatedAt: '',
    });
    const { element } = await setup({
      get: vi.fn(() => of({ ...library, tagIds: ['t2', 'deleted'] })),
      tags: [tag('t1', 'Novela'), tag('t2', 'Prestados')],
    });

    const badges = element.querySelectorAll('.tags app-tag-badge');
    expect(Array.from(badges).map((badge) => badge.textContent?.trim())).toEqual(['Prestados']);
  });

  describe('favorite', () => {
    const favoriteButton = (element: HTMLElement) =>
      element.querySelector<HTMLButtonElement>('[aria-label="Marcar Novela como favorita"]')!;

    it('marks the library as favorite with a bookmark', async () => {
      const { harness, element, update, listByLibrary, openSnackBar } = await setup();
      expect(favoriteButton(element).getAttribute('aria-pressed')).toBe('false');

      favoriteButton(element).click();
      await harness.fixture.whenStable();

      expect(update).toHaveBeenCalledWith('l1', { isFavorite: true });
      expect(favoriteButton(element).getAttribute('aria-pressed')).toBe('true');
      expect(favoriteButton(element).classList).toContain('active');
      // The books do not change: they are not requested again
      expect(listByLibrary).toHaveBeenCalledTimes(1);
      expect(openSnackBar).toHaveBeenCalledWith(
        '«Novela» marcada como favorita',
        undefined,
        expect.anything(),
      );
    });

    it('keeps the mark and reports the error when the change fails', async () => {
      const { harness, element, openSnackBar } = await setup({
        update: vi.fn(() => throwError(() => new Error('down'))),
      });

      favoriteButton(element).click();
      await harness.fixture.whenStable();

      expect(favoriteButton(element).getAttribute('aria-pressed')).toBe('false');
      expect(favoriteButton(element).disabled).toBe(false);
      expect(openSnackBar).toHaveBeenCalledWith(
        'No se ha podido guardar el cambio. Inténtalo de nuevo.',
        undefined,
        expect.anything(),
      );
    });
  });

  it('shows the book count alone when the library has no description', async () => {
    const { element } = await setup({
      get: vi.fn(() => of({ ...library, description: '' })),
      listByLibrary: vi.fn(() => of({ items: [book('1', 'Rossiya')], total: 1 })),
    });

    expect(element.querySelector('.description')?.textContent?.trim()).toBe('1 libro');
  });

  it('shows an empty state when the library has no books', async () => {
    const { element } = await setup();

    expect(element.querySelector('h1')?.textContent).toContain('Novela');
    expect(element.textContent).toContain('Esta biblioteca aún no tiene libros');
    expect(element.querySelector('.count')).toBeNull();
  });

  describe('managing the books', () => {
    const rossiya = book('1', 'Rossiya');
    const withRossiya = () => vi.fn(() => of({ items: [rossiya], total: 1 }));
    const click = (element: HTMLElement, selector: string) =>
      element.querySelector<HTMLButtonElement>(selector)!.click();

    it('reloads the list after adding a book', async () => {
      const { harness, element, listByLibrary, openDialog, openSnackBar } = await setup({
        dialogResult: 'Ulises',
      });

      click(element, '.page-header button[mat-flat-button]');
      await harness.fixture.whenStable();

      expect(openDialog).toHaveBeenCalledWith(
        AddBookDialog,
        expect.objectContaining({ data: { libraryId: 'l1' } }),
      );
      expect(listByLibrary).toHaveBeenCalledTimes(2);
      expect(openSnackBar.mock.lastCall?.[0]).toContain('Ulises');
    });

    it('does nothing when adding a book is cancelled', async () => {
      const { harness, element, listByLibrary, openSnackBar } = await setup();

      click(element, '.page-header button[mat-flat-button]');
      await harness.fixture.whenStable();

      expect(listByLibrary).toHaveBeenCalledTimes(1);
      expect(openSnackBar).not.toHaveBeenCalled();
    });

    it('opens the detail of a book when clicking its card', async () => {
      const { element, openDialog } = await setup({ listByLibrary: withRossiya() });

      click(element, 'app-user-book-card h2 button');

      expect(openDialog).toHaveBeenCalledWith(
        BookDetailDialog,
        expect.objectContaining({ data: { libraryId: 'l1', book: rossiya } }),
      );
    });

    it('shows a book edited from its detail without reloading the list', async () => {
      const { harness, element, listByLibrary, openSnackBar } = await setup({
        listByLibrary: withRossiya(),
        dialogResult: { ...rossiya, rating: 9 },
      });

      click(element, 'app-user-book-card h2 button');
      await harness.fixture.whenStable();

      expect(element.querySelector('app-user-book-card .rating')?.textContent).toContain('9/10');
      expect(openSnackBar).toHaveBeenCalledWith('Cambios guardados', undefined, expect.anything());
      expect(listByLibrary).toHaveBeenCalledTimes(1);
    });

    it('reloads the list after removing a book from its detail', async () => {
      const listByLibrary = vi
        .fn()
        .mockReturnValueOnce(of({ items: [rossiya], total: 1 }))
        .mockReturnValue(of({ items: [], total: 0 }));
      const { harness, element, openSnackBar } = await setup({
        listByLibrary,
        dialogResult: 'removed',
      });

      click(element, 'app-user-book-card h2 button');
      await harness.fixture.whenStable();

      expect(element.textContent).toContain('Esta biblioteca aún no tiene libros');
      expect(openSnackBar.mock.lastCall?.[0]).toContain('Rossiya');
    });

    it('changes nothing when the detail is just closed', async () => {
      const { harness, element, listByLibrary, openSnackBar } = await setup({
        listByLibrary: withRossiya(),
      });

      click(element, 'app-user-book-card h2 button');
      await harness.fixture.whenStable();

      expect(element.querySelectorAll('app-user-book-card').length).toBe(1);
      expect(listByLibrary).toHaveBeenCalledTimes(1);
      expect(openSnackBar).not.toHaveBeenCalled();
    });

    it('reloads the list and keeps the focus in the page after removing a book', async () => {
      const listByLibrary = vi
        .fn()
        .mockReturnValueOnce(of({ items: [rossiya], total: 1 }))
        .mockReturnValue(of({ items: [], total: 0 }));
      const { harness, element, openDialog } = await setup({ listByLibrary, dialogResult: true });
      document.body.appendChild(element);

      click(element, 'app-user-book-card [aria-label^="Quitar"]');
      await harness.fixture.whenStable();

      expect(openDialog).toHaveBeenCalledWith(
        RemoveBookDialog,
        expect.objectContaining({ data: { libraryId: 'l1', book: rossiya } }),
      );
      expect(element.textContent).toContain('Esta biblioteca aún no tiene libros');
      expect(document.activeElement).toBe(
        element.querySelector('.page-header button[mat-flat-button]'),
      );
      element.remove();
    });

    it('goes to the previous page when the last book of a page is removed', async () => {
      const listByLibrary = vi.fn((_id: string, { skip }: { skip: number }) =>
        of({ items: skip < 12 ? [rossiya] : [], total: 12 }),
      );
      // First load on ?page=2 would redirect, so start with 13 books and then have 12
      listByLibrary.mockReturnValueOnce(of({ items: [rossiya], total: 13 }));
      const { harness, router, element } = await setup({
        url: '/libraries/l1?page=2',
        listByLibrary,
        dialogResult: true,
      });

      click(element, 'app-user-book-card [aria-label^="Quitar"]');
      await harness.fixture.whenStable();

      expect(router.url).toBe('/libraries/l1');
      expect(element.querySelectorAll('app-user-book-card').length).toBe(1);
    });
  });

  describe('pagination in the URL', () => {
    it('keeps the page in the URL without requesting the library again', async () => {
      const listByLibrary = thirteenBooks();
      const { harness, router, element, get } = await setup({ listByLibrary });

      element.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')!.click();
      await harness.fixture.whenStable();

      expect(router.url).toBe('/libraries/l1?page=2');
      expect(listByLibrary).toHaveBeenLastCalledWith('l1', { skip: 12, limit: 12, search: '' });
      expect(get).toHaveBeenCalledTimes(1);
      expect(element.querySelector('app-user-book-card')?.textContent).toContain('Libro 12');
    });

    it('jumps to the last and the first page', async () => {
      const listByLibrary = vi.fn(() => of({ items: [book('1', 'Rossiya')], total: 60 }));
      const { harness, router, element } = await setup({
        url: '/libraries/l1?page=2',
        listByLibrary,
      });

      element.querySelector<HTMLButtonElement>('button[aria-label="Última página"]')!.click();
      await harness.fixture.whenStable();

      expect(router.url).toBe('/libraries/l1?page=5');
      expect(listByLibrary).toHaveBeenLastCalledWith('l1', { skip: 48, limit: 12, search: '' });

      element.querySelector<HTMLButtonElement>('button[aria-label="Primera página"]')!.click();
      await harness.fixture.whenStable();

      expect(router.url).toBe('/libraries/l1');
      expect(listByLibrary).toHaveBeenLastCalledWith('l1', { skip: 0, limit: 12, search: '' });
    });

    it('restores the page and its size from the URL', async () => {
      const listByLibrary = vi.fn(() => of({ items: [book('1', 'Rossiya')], total: 60 }));
      const { element } = await setup({ url: '/libraries/l1?page=2&limit=24', listByLibrary });

      expect(listByLibrary).toHaveBeenCalledTimes(1);
      expect(listByLibrary).toHaveBeenCalledWith('l1', { skip: 24, limit: 24, search: '' });
      expect(element.querySelector('.mat-mdc-paginator-range-label')?.textContent).toContain(
        '25 – 48 de 60',
      );
    });

    it('follows URL changes such as back/forward', async () => {
      const listByLibrary = thirteenBooks();
      const { harness } = await setup({ url: '/libraries/l1?page=2', listByLibrary });

      await harness.navigateByUrl('/libraries/l1');
      await harness.fixture.whenStable();

      expect(listByLibrary).toHaveBeenLastCalledWith('l1', { skip: 0, limit: 12, search: '' });
    });

    it('falls back to the defaults on invalid values', async () => {
      const listByLibrary = vi.fn(() => of({ items: [], total: 0 }));
      await setup({ url: '/libraries/l1?page=abc&limit=7', listByLibrary });

      expect(listByLibrary).toHaveBeenCalledWith('l1', { skip: 0, limit: 12, search: '' });
    });

    it('goes to the last page when the URL points past the end', async () => {
      const listByLibrary = thirteenBooks();
      const { router, element } = await setup({ url: '/libraries/l1?page=9', listByLibrary });

      expect(router.url).toBe('/libraries/l1?page=2');
      expect(listByLibrary).toHaveBeenLastCalledWith('l1', { skip: 12, limit: 12, search: '' });
      expect(element.querySelector('app-user-book-card')?.textContent).toContain('Libro 12');
      expect(element.textContent).not.toContain('aún no tiene libros');
    });
  });

  it.each([403, 404])('shows a not-found state on a %i response', async (statusCode) => {
    const { element } = await setup({
      get: vi.fn(() => throwError(() => new ApiError(statusCode, null, 'library not found'))),
    });

    expect(element.textContent).toContain('No hemos encontrado esta biblioteca');
    expect(element.textContent).not.toContain('Reintentar');
    expect(element.querySelector('a.back')).not.toBeNull();
  });

  it('offers a retry on other errors', async () => {
    const listByLibrary = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new ApiError(500, null, 'boom')))
      .mockReturnValue(of({ items: [book('1', 'Rossiya')], total: 1 }));
    const { harness, element } = await setup({ listByLibrary });

    const retry = Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reintentar'),
    )!;
    retry.click();
    await harness.fixture.whenStable();

    expect(element.textContent).not.toContain('No se han podido cargar');
    expect(element.querySelectorAll('app-user-book-card').length).toBe(1);
  });

  it('reloads from scratch when the route points to another library', async () => {
    const { harness, get, listByLibrary } = await setup({ url: '/libraries/l1?page=2' });

    await harness.navigateByUrl('/libraries/l2');
    await harness.fixture.whenStable();

    expect(get).toHaveBeenLastCalledWith('l2');
    expect(listByLibrary).toHaveBeenLastCalledWith('l2', { skip: 0, limit: 12, search: '' });
  });

  describe('search', () => {
    afterEach(() => vi.useRealTimers());

    const all = [book('1', 'Rossiya'), book('2', 'Ulises')];
    const byTitle = () =>
      vi.fn((_id: string, options: { search: string }) => {
        const items = all.filter((item) =>
          item.bookTitle.toLowerCase().includes(options.search.toLowerCase()),
        );
        return of({ items, total: items.length });
      });

    async function setupSearch(url = '/libraries/l1', listByLibrary = byTitle()) {
      const page = await setup({ url, listByLibrary });
      // After the first load: the paginator keeps the page from becoming stable with fake timers
      vi.useFakeTimers();
      /** Lets timers, pending navigations and change detection run. */
      const wait = async (ms = 0) => {
        await vi.advanceTimersByTimeAsync(ms);
        page.harness.fixture.detectChanges();
      };
      const input = () =>
        page.element.querySelector<HTMLInputElement>(
          'input[aria-label="Buscar libros en esta biblioteca"]',
        );
      const type = (value: string) => {
        input()!.value = value;
        input()!.dispatchEvent(new Event('input'));
        page.harness.fixture.detectChanges();
      };
      await wait();
      return { ...page, wait, input, type };
    }

    it('searches in the library after the user stops typing and keeps the search in the URL', async () => {
      const { element, get, listByLibrary, router, type, wait } = await setupSearch(
        '/libraries/l1?page=2',
        // 13 books without a search, so the second page exists
        vi.fn((_id: string, options: { search: string }) =>
          options.search
            ? of({ items: [book('1', 'Rossiya')], total: 1 })
            : of({ items: [book('13', 'Libro 13')], total: 13 }),
        ),
      );
      listByLibrary.mockClear();

      type('ros');
      await wait(SEARCH_DEBOUNCE_MS - 1);
      expect(listByLibrary).not.toHaveBeenCalled();

      await wait(1);
      // A new search starts again from the first page
      expect(router.url).toBe('/libraries/l1?q=ros');
      expect(listByLibrary).toHaveBeenLastCalledWith('l1', { skip: 0, limit: 12, search: 'ros' });
      expect(element.querySelectorAll('app-user-book-card').length).toBe(1);
      expect(element.querySelector('.count')?.textContent).toContain('1 resultado');
      // The library does not change with the search: it is not requested again
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('restores the search from the URL', async () => {
      const { listByLibrary, input } = await setupSearch('/libraries/l1?q=ulises');

      expect(listByLibrary).toHaveBeenCalledTimes(1);
      expect(listByLibrary).toHaveBeenLastCalledWith('l1', {
        skip: 0,
        limit: 12,
        search: 'ulises',
      });
      expect(input()?.value).toBe('ulises');
    });

    it('shows a no-results state that clears the search and the URL', async () => {
      const { element, listByLibrary, router, wait } = await setupSearch(
        '/libraries/l1?q=poes%C3%ADa',
      );
      expect(element.textContent).toContain(
        'Ningún libro de esta biblioteca coincide con «poesía»',
      );
      expect(element.textContent).not.toContain('aún no tiene libros');

      const clear = Array.from(element.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Borrar búsqueda'),
      )!;
      clear.click();
      await wait();

      expect(router.url).toBe('/libraries/l1');
      expect(listByLibrary).toHaveBeenLastCalledWith('l1', { skip: 0, limit: 12, search: '' });
      expect(element.querySelectorAll('app-user-book-card').length).toBe(2);

      // The cleared search is not re-applied when the debounce time passes
      const calls = listByLibrary.mock.calls.length;
      await wait(SEARCH_DEBOUNCE_MS);
      expect(listByLibrary).toHaveBeenCalledTimes(calls);
    });

    it('hides the search field when the library has no books', async () => {
      const { input } = await setupSearch(
        '/libraries/l1',
        vi.fn(() => of({ items: [], total: 0 })),
      );

      expect(input()).toBeNull();
    });
  });
});
