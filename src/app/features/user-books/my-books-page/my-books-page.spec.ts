import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { SEARCH_DEBOUNCE_MS } from '../../../core/lists/searchable-list';
import { BookDetailDialog } from '../../libraries/book-detail-dialog/book-detail-dialog';
import { UserBook } from '../user-book.model';
import { UserBooksService } from '../user-books.service';
import { MyBooksPage } from './my-books-page';

function book(id: string, title: string, libraries = ['l1']): UserBook {
  return {
    id,
    libraries,
    bookId: `b-${id}`,
    bookTitle: title,
    bookAuthors: ['Autora'],
    bookCoverUrl: null,
    bookIsbn13: '9780595385294',
    bookIsbn10: null,
    rating: null,
    notes: null,
    readingStatus: null,
    finishedAt: null,
    userId: 'u1',
    createdAt: '',
    updatedAt: '',
  };
}

describe('MyBooksPage', () => {
  afterEach(() => localStorage.clear());

  async function setup(
    options: { url?: string; list?: ReturnType<typeof vi.fn>; dialogResult?: unknown } = {},
  ) {
    const list = options.list ?? vi.fn(() => of({ items: [], total: 0 }));
    const openDialog = vi.fn(() => ({ afterClosed: () => of(options.dialogResult) }));
    const openSnackBar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        // Real routing: the page receives ?page= and ?limit= through input binding
        provideRouter([{ path: 'books', component: MyBooksPage }], withComponentInputBinding()),
        { provide: UserBooksService, useValue: { list } },
        { provide: MatDialog, useValue: { open: openDialog } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
      ],
    });
    const harness = await RouterTestingHarness.create(options.url ?? '/books');
    await harness.fixture.whenStable();
    return {
      harness,
      router: TestBed.inject(Router),
      element: harness.routeNativeElement as HTMLElement,
      list,
      openDialog,
      openSnackBar,
    };
  }

  it('shows the books with their library count and no way to remove them', async () => {
    const { element, list } = await setup({
      list: vi.fn(() =>
        of({ items: [book('1', 'Rossiya'), book('2', 'Ulises', ['l1', 'l2'])], total: 2 }),
      ),
    });

    expect(list).toHaveBeenCalledWith({
      skip: 0,
      limit: 12,
      search: '',
      readingStatus: '',
      readYear: null,
    });
    expect(element.querySelector('h1')?.textContent).toContain('Mis libros');
    expect(element.querySelector('.count')?.textContent).toContain('2 libros');
    expect(element.querySelectorAll('app-user-book-card').length).toBe(2);
    expect(element.textContent).toContain('En 1 biblioteca');
    expect(element.textContent).toContain('En 2 bibliotecas');
    expect(element.querySelector('[aria-label^="Quitar"]')).toBeNull();
  });

  describe('table view', () => {
    const books = () =>
      of({ items: [book('1', 'Rossiya'), book('2', 'Ulises', ['l1', 'l2'])], total: 2 });

    it('switches to a table and back, remembering the choice', async () => {
      const { harness, element } = await setup({ list: vi.fn(books) });

      element.querySelector<HTMLButtonElement>('button[aria-label="Ver como tabla"]')!.click();
      await harness.fixture.whenStable();

      expect(element.querySelector('app-user-book-card')).toBeNull();
      expect(element.querySelectorAll('app-user-books-table tbody tr').length).toBe(2);
      expect(element.textContent).toContain('2 bibliotecas');
      expect(element.querySelector('[aria-label^="Quitar"]')).toBeNull();
      expect(localStorage.getItem('bibliopolis.booksView')).toBe('table');

      element.querySelector<HTMLButtonElement>('button[aria-label="Ver como tarjetas"]')!.click();
      await harness.fixture.whenStable();

      expect(element.querySelector('app-user-books-table')).toBeNull();
      expect(element.querySelectorAll('app-user-book-card').length).toBe(2);
    });

    it('starts with the stored view and opens the detail from a row', async () => {
      localStorage.setItem('bibliopolis.booksView', 'table');
      const { harness, element, openDialog } = await setup({ list: vi.fn(books) });

      element.querySelector<HTMLButtonElement>('app-user-books-table button.open')!.click();
      await harness.fixture.whenStable();

      expect(openDialog).toHaveBeenCalledWith(
        BookDetailDialog,
        expect.objectContaining({ data: { book: book('1', 'Rossiya') } }),
      );
    });

    it('is not offered while the user has no books', async () => {
      const { element } = await setup();

      expect(element.querySelector('app-books-view-toggle')).toBeNull();
    });
  });

  it('points to the libraries when the user has no books', async () => {
    const { element } = await setup();

    expect(element.textContent).toContain('Aún no tienes libros');
    expect(element.querySelector('a[href="/libraries"]')).not.toBeNull();
    expect(element.querySelector('.count')).toBeNull();
    expect(element.querySelector('mat-paginator')).toBeNull();
  });

  it('requests the page in the URL', async () => {
    const list = vi.fn(() => of({ items: [book('1', 'Rossiya')], total: 60 }));

    const { element } = await setup({ url: '/books?page=3&limit=24', list });

    expect(list).toHaveBeenCalledWith({
      skip: 48,
      limit: 24,
      search: '',
      readingStatus: '',
      readYear: null,
    });
    expect(element.querySelector('mat-paginator')).not.toBeNull();
  });

  it('moves to the last page when the URL points past the end', async () => {
    const list = vi.fn(() => of({ items: [book('1', 'Rossiya')], total: 13 }));

    const { router } = await setup({ url: '/books?page=9', list });

    expect(router.url).toBe('/books?page=2');
    expect(list).toHaveBeenLastCalledWith({
      skip: 12,
      limit: 12,
      search: '',
      readingStatus: '',
      readYear: null,
    });
  });

  it('offers retrying after an error', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('boom')))
      .mockReturnValue(of({ items: [book('1', 'Rossiya')], total: 1 }));
    const { harness, element } = await setup({ list });

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se han podido cargar',
    );

    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await harness.fixture.whenStable();

    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelectorAll('app-user-book-card').length).toBe(1);
  });

  it('opens the detail without a library and updates the card in place after saving', async () => {
    const original = book('1', 'Rossiya');
    const list = vi.fn(() => of({ items: [original], total: 1 }));
    const { harness, element, openDialog, openSnackBar } = await setup({
      list,
      dialogResult: { ...original, rating: 9 },
    });

    element.querySelector<HTMLButtonElement>('app-user-book-card h2 button')!.click();
    await harness.fixture.whenStable();

    expect(openDialog).toHaveBeenCalledWith(
      BookDetailDialog,
      expect.objectContaining({ data: { book: original } }),
    );
    expect(element.querySelector('.rating')?.textContent).toContain('9/10');
    expect(openSnackBar).toHaveBeenCalledWith('Cambios guardados', undefined, { duration: 4000 });
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the detail closes without changes', async () => {
    const list = vi.fn(() => of({ items: [book('1', 'Rossiya')], total: 1 }));
    const { harness, element, openSnackBar } = await setup({ list });

    element.querySelector<HTMLButtonElement>('app-user-book-card h2 button')!.click();
    await harness.fixture.whenStable();

    expect(openSnackBar).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(1);
  });

  describe('search', () => {
    afterEach(() => vi.useRealTimers());

    const all = [book('1', 'Rossiya'), book('2', 'Ulises')];
    const byTitle = vi.fn((options: { search: string }) => {
      const items = all.filter((item) =>
        item.bookTitle.toLowerCase().includes(options.search.toLowerCase()),
      );
      return of({ items, total: items.length });
    });

    async function setupSearch(url = '/books', list = byTitle) {
      list.mockClear();
      const page = await setup({ url, list });
      // After the first load: the filter keeps the page from becoming stable with fake timers
      vi.useFakeTimers();
      /** Lets timers, pending navigations and change detection run. */
      const wait = async (ms = 0) => {
        await vi.advanceTimersByTimeAsync(ms);
        page.harness.fixture.detectChanges();
      };
      const input = () =>
        page.element.querySelector<HTMLInputElement>('input[aria-label="Buscar libros"]');
      const type = (value: string) => {
        input()!.value = value;
        input()!.dispatchEvent(new Event('input'));
        page.harness.fixture.detectChanges();
      };
      await wait();
      return { ...page, wait, input, type };
    }

    it('searches after the user stops typing and keeps the search in the URL', async () => {
      const { element, list, router, type, wait } = await setupSearch();
      expect(list).toHaveBeenCalledTimes(1);

      type('ros');
      await wait(SEARCH_DEBOUNCE_MS - 1);
      expect(list).toHaveBeenCalledTimes(1);

      await wait(1);
      expect(router.url).toBe('/books?q=ros');
      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: 'ros',
        readingStatus: '',
        readYear: null,
      });
      expect(element.querySelectorAll('app-user-book-card').length).toBe(1);
      expect(element.querySelector('.count')?.textContent).toContain('1 resultado');
    });

    it('restores the search from the URL', async () => {
      const { list, input } = await setupSearch('/books?q=ulises');

      expect(list).toHaveBeenCalledTimes(1);
      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: 'ulises',
        readingStatus: '',
        readYear: null,
      });
      expect(input()?.value).toBe('ulises');
    });

    it('shows a no-results state that clears the search and the URL', async () => {
      const { element, list, router, wait } = await setupSearch('/books?q=poes%C3%ADa');
      expect(element.textContent).toContain('Ningún libro coincide con «poesía»');
      expect(element.textContent).not.toContain('Aún no tienes libros');

      const clear = Array.from(element.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Borrar búsqueda'),
      )!;
      clear.click();
      await wait();

      expect(router.url).toBe('/books');
      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: '',
        readingStatus: '',
        readYear: null,
      });
      expect(element.querySelectorAll('app-user-book-card').length).toBe(2);
    });

    it('hides the search field when the user has no books', async () => {
      const { input } = await setupSearch(
        '/books',
        vi.fn(() => of({ items: [], total: 0 })),
      );

      expect(input()).toBeNull();
    });
  });

  describe('reading status filter', () => {
    const statusText = (element: HTMLElement) =>
      element.querySelector('.status-select')?.textContent?.trim();
    /** Opens the status select and picks an option, which lives in an overlay. */
    const chooseStatus = async (
      harness: RouterTestingHarness,
      element: HTMLElement,
      label: string,
    ) => {
      element.querySelector<HTMLElement>('.status-select .mat-mdc-select-trigger')!.click();
      await harness.fixture.whenStable();
      Array.from(document.querySelectorAll<HTMLElement>('mat-option'))
        .find((option) => option.textContent?.includes(label))!
        .click();
      await harness.fixture.whenStable();
    };
    const withBooks = () => vi.fn(() => of({ items: [book('1', 'Rossiya')], total: 1 }));

    it('requests the status and the year in the URL', async () => {
      const { list, element } = await setup({
        url: '/books?status=read&year=2026',
        list: withBooks(),
      });

      expect(list).toHaveBeenCalledWith({
        skip: 0,
        limit: 12,
        search: '',
        readingStatus: 'read',
        readYear: 2026,
      });
      expect(statusText(element)).toBe('Leído');
      expect(element.querySelector('.count')?.textContent).toContain('1 resultado');
    });

    it('ignores the year without the status read, and an unknown status', async () => {
      const reading = await setup({ url: '/books?status=reading&year=2026', list: withBooks() });
      expect(reading.list).toHaveBeenCalledWith(
        expect.objectContaining({ readingStatus: 'reading', readYear: null }),
      );
      TestBed.resetTestingModule();

      const unknown = await setup({ url: '/books?status=abandoned', list: withBooks() });
      expect(unknown.list).toHaveBeenCalledWith(
        expect.objectContaining({ readingStatus: '', readYear: null }),
      );
    });

    it('keeps the chosen status in the URL, back on the first page', async () => {
      const { harness, router, element, list } = await setup({
        url: '/books?page=2&q=ros',
        list: vi.fn(() => of({ items: [book('1', 'Rossiya')], total: 30 })),
      });

      await chooseStatus(harness, element, 'Pendiente');

      expect(router.url).toBe('/books?q=ros&status=to_read');
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ skip: 0, search: 'ros', readingStatus: 'to_read' }),
      );
    });

    it('drops the year when the status read is removed', async () => {
      const { harness, router, element } = await setup({
        url: '/books?status=read&year=2026',
        list: withBooks(),
      });

      await chooseStatus(harness, element, 'Todos los estados');

      expect(router.url).toBe('/books');
    });

    it('says when no book has the status, and offers removing the filter', async () => {
      const list = vi.fn((options: { readingStatus: string }) =>
        of(
          options.readingStatus
            ? { items: [], total: 0 }
            : { items: [book('1', 'Rossiya')], total: 1 },
        ),
      );
      const { harness, router, element } = await setup({
        url: '/books?status=read&year=2025',
        list,
      });

      expect(element.textContent).toContain('No tienes libros leídos en 2025');
      expect(element.textContent).not.toContain('Aún no tienes libros');
      // The filter stays, so it can be changed
      expect(element.querySelector('app-reading-status-filter')).not.toBeNull();

      Array.from(element.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Quitar filtro'))!
        .click();
      await harness.fixture.whenStable();

      expect(router.url).toBe('/books');
      expect(element.querySelectorAll('app-user-book-card').length).toBe(1);
    });

    it('reloads the list after saving a book, which may no longer have the status', async () => {
      const original = book('1', 'Rossiya');
      const list = vi.fn(() => of({ items: [original], total: 1 }));
      const { harness, element } = await setup({
        url: '/books?status=to_read',
        list,
        dialogResult: { ...original, readingStatus: 'read' },
      });
      expect(list).toHaveBeenCalledTimes(1);

      element.querySelector<HTMLButtonElement>('app-user-book-card h2 button')!.click();
      await harness.fixture.whenStable();

      expect(list).toHaveBeenCalledTimes(2);
    });
  });
});
