import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { UserBook } from '../../user-books/user-book.model';
import { UserBooksService } from '../../user-books/user-books.service';
import { AddBookDialog } from '../add-book-dialog/add-book-dialog';
import { BookDetailDialog } from '../book-detail-dialog/book-detail-dialog';
import { LibrariesService } from '../libraries.service';
import { Library } from '../library.model';
import { RemoveBookDialog } from '../remove-book-dialog/remove-book-dialog';
import { ScanBooksDialog } from '../scan-books-dialog/scan-books-dialog';
import { LibraryDetailPage } from './library-detail-page';

const library: Library = {
  id: 'l1',
  name: 'Novela',
  description: 'Mis novelas',
  books: [],
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
  async function setup(
    options: {
      url?: string;
      get?: ReturnType<typeof vi.fn>;
      listByLibrary?: ReturnType<typeof vi.fn>;
      dialogResult?: unknown;
      touchDevice?: boolean;
    } = {},
  ) {
    const get = options.get ?? vi.fn(() => of(library));
    const listByLibrary = options.listByLibrary ?? vi.fn(() => of({ items: [], total: 0 }));
    const openDialog = vi.fn(() => ({ afterClosed: () => of(options.dialogResult) }));
    const openSnackBar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        // Real routing: the page receives :id, ?page= and ?limit= through input binding
        provideRouter(
          [{ path: 'libraries/:id', component: LibraryDetailPage }],
          withComponentInputBinding(),
        ),
        { provide: LibrariesService, useValue: { get } },
        { provide: UserBooksService, useValue: { listByLibrary } },
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
      listByLibrary,
      openDialog,
      openSnackBar,
    };
  }

  it('shows the library and its books', async () => {
    const { element, get, listByLibrary } = await setup({
      listByLibrary: vi.fn(() =>
        of({ items: [book('1', 'Rossiya'), book('2', 'Ulises')], total: 2 }),
      ),
    });

    expect(get).toHaveBeenCalledWith('l1');
    expect(listByLibrary).toHaveBeenCalledWith('l1', { skip: 0, limit: 12 });
    expect(element.querySelector('h1')?.textContent).toContain('Novela');
    expect(element.textContent).toContain('Mis novelas');
    expect(element.querySelector('.count')?.textContent).toContain('2 libros');
    const cards = element.querySelectorAll('app-user-book-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Rossiya');
    expect(element.querySelector('mat-paginator')).toBeNull();
    expect(element.querySelector('a.back')?.getAttribute('href')).toBe('/libraries');
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

      click(element, '.page-header button');
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

      click(element, '.page-header button');
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
      expect(document.activeElement).toBe(element.querySelector('.page-header button'));
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
      expect(listByLibrary).toHaveBeenLastCalledWith('l1', { skip: 12, limit: 12 });
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
      expect(listByLibrary).toHaveBeenLastCalledWith('l1', { skip: 48, limit: 12 });

      element.querySelector<HTMLButtonElement>('button[aria-label="Primera página"]')!.click();
      await harness.fixture.whenStable();

      expect(router.url).toBe('/libraries/l1');
      expect(listByLibrary).toHaveBeenLastCalledWith('l1', { skip: 0, limit: 12 });
    });

    it('restores the page and its size from the URL', async () => {
      const listByLibrary = vi.fn(() => of({ items: [book('1', 'Rossiya')], total: 60 }));
      const { element } = await setup({ url: '/libraries/l1?page=2&limit=24', listByLibrary });

      expect(listByLibrary).toHaveBeenCalledTimes(1);
      expect(listByLibrary).toHaveBeenCalledWith('l1', { skip: 24, limit: 24 });
      expect(element.querySelector('.mat-mdc-paginator-range-label')?.textContent).toContain(
        '25 – 48 de 60',
      );
    });

    it('follows URL changes such as back/forward', async () => {
      const listByLibrary = thirteenBooks();
      const { harness } = await setup({ url: '/libraries/l1?page=2', listByLibrary });

      await harness.navigateByUrl('/libraries/l1');
      await harness.fixture.whenStable();

      expect(listByLibrary).toHaveBeenLastCalledWith('l1', { skip: 0, limit: 12 });
    });

    it('falls back to the defaults on invalid values', async () => {
      const listByLibrary = vi.fn(() => of({ items: [], total: 0 }));
      await setup({ url: '/libraries/l1?page=abc&limit=7', listByLibrary });

      expect(listByLibrary).toHaveBeenCalledWith('l1', { skip: 0, limit: 12 });
    });

    it('goes to the last page when the URL points past the end', async () => {
      const listByLibrary = thirteenBooks();
      const { router, element } = await setup({ url: '/libraries/l1?page=9', listByLibrary });

      expect(router.url).toBe('/libraries/l1?page=2');
      expect(listByLibrary).toHaveBeenLastCalledWith('l1', { skip: 12, limit: 12 });
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
    expect(listByLibrary).toHaveBeenLastCalledWith('l2', { skip: 0, limit: 12 });
  });
});
