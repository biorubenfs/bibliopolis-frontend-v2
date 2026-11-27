import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { CatalogBook } from '../backoffice/books/catalog-book.model';
import { CatalogBooksService } from '../backoffice/books/catalog-books.service';
import { CatalogBookDialog } from './catalog-book-dialog/catalog-book-dialog';
import { ExplorePage, LATEST_BOOKS_LIMIT } from './explore-page';

function book(id: string, title: string, coverUrl: string | null = null): CatalogBook {
  return {
    id,
    title,
    authors: ['Autora'],
    isbn13: '9780595385294',
    isbn10: null,
    coverUrl,
    createdAt: '',
    updatedAt: '',
  };
}

describe('ExplorePage', () => {
  async function setup(list: ReturnType<typeof vi.fn>) {
    const openDialog = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogBooksService, useValue: { list } },
        { provide: MatDialog, useValue: { open: openDialog } },
      ],
    });
    const fixture = TestBed.createComponent(ExplorePage);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement, openDialog };
  }

  it('asks for the newest books of the catalog with a cover', async () => {
    const list = vi.fn(() => of({ items: [], total: 0 }));
    await setup(list);

    expect(list).toHaveBeenCalledWith({
      skip: 0,
      limit: LATEST_BOOKS_LIMIT,
      hasCover: true,
    });
  });

  it('shows the books in the shelf, with a placeholder for those without a cover', async () => {
    const list = vi.fn(() =>
      of({
        items: [book('b1', 'Dune', 'https://covers/dune.jpg'), book('b2', 'Solaris')],
        total: 2,
      }),
    );
    const { element } = await setup(list);

    const titles = [...element.querySelectorAll('.title')].map((node) => node.textContent?.trim());
    expect(titles).toEqual(['Dune', 'Solaris']);
    expect(element.querySelector('img')?.getAttribute('src')).toBe('https://covers/dune.jpg');
    expect(element.querySelector('.placeholder')?.textContent?.trim()).toBe('Solaris');
  });

  it('opens the details of a book', async () => {
    const dune = book('b1', 'Dune');
    const { element, openDialog } = await setup(vi.fn(() => of({ items: [dune], total: 1 })));

    element.querySelector<HTMLButtonElement>('.open')!.click();

    expect(openDialog).toHaveBeenCalledWith(
      CatalogBookDialog,
      expect.objectContaining({ data: dune }),
    );
  });

  it('says so when the catalog is empty', async () => {
    const { element } = await setup(vi.fn(() => of({ items: [], total: 0 })));

    expect(element.textContent).toContain('Aún no hay libros en Bibliopolis');
    expect(element.querySelector('app-book-shelf')).toBeNull();
  });

  it('offers to retry after an error', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValueOnce(of({ items: [book('b1', 'Dune')], total: 1 }));
    const { fixture, element } = await setup(list);

    expect(element.textContent).toContain('No se han podido cargar los libros.');
    element.querySelector<HTMLButtonElement>('.status button')!.click();
    await fixture.whenStable();

    expect(list).toHaveBeenCalledTimes(2);
    expect(element.querySelector('.title')?.textContent?.trim()).toBe('Dune');
  });
});
