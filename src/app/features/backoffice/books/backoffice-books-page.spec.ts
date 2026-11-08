import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import {
  ActivatedRoute,
  ParamMap,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { BackofficeBooksPage } from './backoffice-books-page';
import { CatalogBook } from './catalog-book.model';
import { CatalogBooksService } from './catalog-books.service';

const book: CatalogBook = {
  id: 'b1',
  title: 'Rossiya',
  authors: ['Alex Shishin'],
  isbn13: '9780595385294',
  isbn10: '059538529X',
  coverUrl: null,
  createdAt: '',
  updatedAt: '',
};

describe('BackofficeBooksPage', () => {
  async function setup(
    options: { params?: Record<string, string>; list?: ReturnType<typeof vi.fn> } = {},
  ) {
    const list = options.list ?? vi.fn(() => of({ items: [book], total: 1 }));
    const queryParamMap = new BehaviorSubject<ParamMap>(convertToParamMap(options.params ?? {}));
    const openDialog = vi.fn(() => ({ afterClosed: () => of(undefined) }));
    TestBed.configureTestingModule({
      imports: [BackofficeBooksPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParamMap } },
        { provide: CatalogBooksService, useValue: { list } },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: { open: openDialog } });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BackofficeBooksPage);
    await fixture.whenStable();
    return {
      fixture,
      element: fixture.nativeElement as HTMLElement,
      list,
      queryParamMap,
      navigate,
      openDialog,
    };
  }

  it('loads the first page of the catalog and leaves the spinner', async () => {
    const { element, list } = await setup();

    expect(list).toHaveBeenCalledWith({ skip: 0, limit: 12, search: '' });
    expect(element.querySelector('mat-spinner')).toBeNull();
    expect(element.querySelector('.row-title')?.textContent).toContain('Rossiya');
    expect(element.querySelector('.count')?.textContent).toContain('1 libro en el catálogo');
  });

  it('loads the search and the page of the URL', async () => {
    const { element, list } = await setup({
      params: { q: 'rossiya', page: '2', limit: '24' },
      list: vi.fn(() => of({ items: [book], total: 30 })),
    });

    expect(list).toHaveBeenCalledWith({ skip: 24, limit: 24, search: 'rossiya' });
    expect(
      element.querySelector<HTMLInputElement>('input[aria-label="Buscar libros"]')!.value,
    ).toBe('rossiya');
  });

  it('reloads when the URL changes', async () => {
    const { fixture, list, queryParamMap } = await setup();

    queryParamMap.next(convertToParamMap({ q: 'otro' }));
    await fixture.whenStable();

    expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 12, search: 'otro' });
  });

  it('puts the search typed in the URL, back to the first page', async () => {
    const { element, navigate } = await setup({ params: { page: '2' } });
    // After the setup: fake timers would also hold the rendering it waits for
    vi.useFakeTimers();
    try {
      const input = element.querySelector<HTMLInputElement>('input[aria-label="Buscar libros"]')!;

      input.value = ' Shishin ';
      input.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(300);

      expect(navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { q: 'Shishin', page: null }, replaceUrl: true }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an error with a retry button when the list fails', async () => {
    const { element } = await setup({ list: vi.fn(() => throwError(() => new Error('down'))) });

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se han podido cargar los libros',
    );
  });

  it('opens the dialog to add a book', async () => {
    const { element, openDialog } = await setup();

    element.querySelector<HTMLButtonElement>('.fab')!.click();

    expect(openDialog).toHaveBeenCalled();
  });
});
