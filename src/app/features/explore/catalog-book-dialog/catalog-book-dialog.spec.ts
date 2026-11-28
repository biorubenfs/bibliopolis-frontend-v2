import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';

import { CatalogBook } from '../../backoffice/books/catalog-book.model';
import { AddToLibrariesDialog } from '../../libraries/add-to-libraries-dialog/add-to-libraries-dialog';
import { CatalogBookDialog } from './catalog-book-dialog';

describe('CatalogBookDialog', () => {
  const book: CatalogBook = {
    id: 'b1',
    title: 'Dune',
    authors: ['Frank Herbert'],
    isbn13: '9780441013593',
    isbn10: '0441013597',
    coverUrl: null,
    createdAt: '',
    updatedAt: '',
  };

  async function setup(addResult?: { id: string; name: string }[]) {
    const open = vi.fn(() => ({ afterClosed: () => of(addResult) }));
    const close = vi.fn();
    const openSnackBar = vi.fn();
    // MatDialogModule brings its own MatDialog, which a plain provider would not replace
    TestBed.overrideProvider(MatDialog, { useValue: { open } });
    TestBed.configureTestingModule({
      imports: [CatalogBookDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: book },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
      ],
    });
    const fixture = TestBed.createComponent(CatalogBookDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const addButton = Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Añadir a mis bibliotecas'),
    )!;
    return { element, open, close, openSnackBar, addButton };
  }

  it('shows the book', async () => {
    const { element } = await setup();

    expect(element.querySelector('h2')?.textContent).toContain('Dune');
    expect(element.textContent).toContain('Frank Herbert');
    expect(element.textContent).toContain('ISBN-10: 0441013597');
  });

  it('adds the book to libraries of the user and closes, telling where', async () => {
    const { open, close, openSnackBar, addButton } = await setup([{ id: 'l1', name: 'Novela' }]);

    addButton.click();

    expect(open).toHaveBeenCalledWith(
      AddToLibrariesDialog,
      expect.objectContaining({
        data: {
          title: 'Dune',
          isbn13: '9780441013593',
          isbn10: '0441013597',
          authors: ['Frank Herbert'],
        },
      }),
    );
    expect(openSnackBar).toHaveBeenCalledWith('«Dune» añadido a «Novela»', undefined, {
      duration: 4000,
    });
    expect(close).toHaveBeenCalled();
  });

  it('stays open if the book was not added', async () => {
    const { close, openSnackBar, addButton } = await setup();

    addButton.click();

    expect(openSnackBar).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});
