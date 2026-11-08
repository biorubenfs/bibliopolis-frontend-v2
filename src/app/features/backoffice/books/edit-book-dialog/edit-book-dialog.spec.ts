import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../../core/http/api-error';
import { CatalogBook, CoverCandidate } from '../catalog-book.model';
import { CatalogBooksService } from '../catalog-books.service';
import { EditBookDialog } from './edit-book-dialog';

const book: CatalogBook = {
  id: 'b1',
  title: 'Rossiya',
  authors: ['Alex Shishin'],
  isbn13: '9780595385294',
  isbn10: '059538529X',
  coverUrl: 'https://covers.example/current.jpg',
  createdAt: '',
  updatedAt: '',
};

const covers: CoverCandidate[] = [
  { source: 'google_books', value: 'g1', coverUrl: 'https://covers.example/g1.jpg' },
  { source: 'open_library', value: '1', coverUrl: 'https://covers.example/o1.jpg' },
];

describe('EditBookDialog', () => {
  async function setup(
    options: {
      book?: CatalogBook;
      covers?: CoverCandidate[];
      update?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    const update =
      options.update ?? vi.fn((_id: string, changes: object) => of({ ...book, ...changes }));
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [EditBookDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { book: options.book ?? book } },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: CatalogBooksService,
          useValue: { listCovers: () => of(options.covers ?? covers), update },
        },
      ],
    });
    const fixture = TestBed.createComponent(EditBookDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const submit = async () => {
      element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
    };
    const chooseCover = async (label: string) => {
      const radio = Array.from(element.querySelectorAll('mat-radio-button')).find((r) =>
        r.textContent?.includes(label),
      );
      radio!.querySelector<HTMLInputElement>('input')!.click();
      await fixture.whenStable();
    };

    return { element, fixture, submit, chooseCover, update, close };
  }

  it('shows the ISBNs without letting them be edited', async () => {
    const { element } = await setup();

    expect(element.querySelector('.isbns')?.textContent).toContain('9780595385294');
    expect(element.querySelector('.isbns')?.textContent).toContain('059538529X');
    const inputs = Array.from(element.querySelectorAll('input')).map((input) => input.value);
    expect(inputs).not.toContain('9780595385294');
  });

  it('offers the current cover, the cover of each source and no cover', async () => {
    const { element } = await setup();

    const options = Array.from(element.querySelectorAll('.cover-label')).map((label) =>
      label.textContent?.trim(),
    );
    expect(options).toEqual(['Actual', 'Google Books', 'Open Library', 'Sin portada']);
  });

  it('only offers no cover when no source has one and the book has none', async () => {
    const { element } = await setup({ book: { ...book, coverUrl: null }, covers: [] });

    const options = Array.from(element.querySelectorAll('.cover-label')).map((label) =>
      label.textContent?.trim(),
    );
    expect(options).toEqual(['Sin portada']);
    expect(element.textContent).toContain('Ninguna fuente tiene portada');
  });

  it('sends only the changes: a new title and the chosen source', async () => {
    const { element, submit, chooseCover, update, close } = await setup();

    const title = element.querySelector<HTMLInputElement>('input[required]')!;
    title.value = ' Rossiya (2.ª ed.) ';
    title.dispatchEvent(new Event('input'));
    await chooseCover('Open Library');
    await submit();

    expect(update).toHaveBeenCalledWith('b1', {
      title: 'Rossiya (2.ª ed.)',
      coverSource: 'open_library',
    });
    expect(close).toHaveBeenCalled();
  });

  it('removes the cover with no cover', async () => {
    const { submit, chooseCover, update } = await setup();

    await chooseCover('Sin portada');
    await submit();

    expect(update).toHaveBeenCalledWith('b1', { coverSource: null });
  });

  it('removes an author', async () => {
    const { element, fixture, submit, update } = await setup();

    element.querySelector<HTMLButtonElement>('[aria-label="Quitar a Alex Shishin"]')!.click();
    await fixture.whenStable();
    await submit();

    expect(update).toHaveBeenCalledWith('b1', { authors: [] });
  });

  it('closes without a request when nothing changed', async () => {
    const { submit, update, close } = await setup();

    await submit();

    expect(update).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledWith();
  });

  it('explains a source that no longer has the cover', async () => {
    const { element, submit, chooseCover } = await setup({
      update: vi.fn(() => throwError(() => new ApiError(422, 'COVER NOT AVAILABLE', 'x'))),
    });

    await chooseCover('Google Books');
    await submit();

    expect(element.querySelector('.error')?.textContent).toContain('ya no tiene portada');
  });
});
