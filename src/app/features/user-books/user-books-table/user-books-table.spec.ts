import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';

import { PersonRating, UserBook } from '../user-book.model';
import { UserBooksTable } from './user-books-table';

describe('UserBooksTable', () => {
  const book: UserBook = {
    id: 'ub1',
    libraries: ['l1'],
    bookId: 'b1',
    bookTitle: 'Rossiya',
    bookAuthors: ['Alex Shishin', 'Otra Autora'],
    bookCoverUrl: 'https://covers.example/1.jpg',
    bookIsbn13: '9780595385294',
    bookIsbn10: '059538529X',
    rating: 8,
    notes: 'Muy recomendable',
    readingStatus: null,
    finishedAt: null,
    userId: 'u1',
    createdAt: '',
    updatedAt: '',
  };
  const other: UserBook = {
    ...book,
    id: 'ub2',
    libraries: ['l1', 'l2'],
    bookTitle: 'Dune',
    bookAuthors: [],
    bookCoverUrl: null,
    bookIsbn10: null,
    rating: null,
  };

  function render(
    inputs: {
      removable?: boolean;
      addable?: boolean;
      addLabel?: string;
      showLibraryCount?: boolean;
      showCover?: boolean;
      showReadingStatus?: boolean;
    } = {},
    books: UserBook[] = [book, other],
  ) {
    const fixture = TestBed.createComponent(UserBooksTable);
    fixture.componentRef.setInput('books', books);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const open = vi.fn();
    const remove = vi.fn();
    const add = vi.fn();
    fixture.componentInstance.openRequested.subscribe(open);
    fixture.componentInstance.removeRequested.subscribe(remove);
    fixture.componentInstance.addRequested.subscribe(add);
    return { fixture, element, open, remove, add, rows: element.querySelectorAll('tbody tr') };
  }

  function headers(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('th'), (th) => th.textContent!.trim());
  }

  it('shows the reading status after the rating, only when asked to', () => {
    const { element, rows } = render({ showReadingStatus: true }, [
      { ...book, readingStatus: 'reading' },
      other,
    ]);

    expect(headers(element)).toEqual([
      'Título',
      'Autores',
      'Valoración',
      'Estado',
      'ISBN-13',
      'ISBN-10',
      'Acciones',
    ]);
    expect(rows[0].querySelector('app-reading-status-badge')?.getAttribute('aria-label')).toBe(
      'Leyendo',
    );
    expect(
      rows[1].querySelector('.mat-column-readingStatus [aria-label]')?.getAttribute('aria-label'),
    ).toBe('Sin estado');
    expect(element.querySelector('table')?.classList).toContain('with-reading-status');
  });

  it('shows one row per book with its data', () => {
    const { element, rows } = render();

    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Rossiya');
    expect(rows[0].textContent).toContain('Alex Shishin, Otra Autora');
    expect(rows[0].textContent).toContain('8/10');
    expect(rows[0].textContent).toContain('9780595385294');
    expect(rows[0].textContent).toContain('059538529X');
    expect(rows[0].textContent).not.toContain('Muy recomendable');
    expect(headers(element)).toEqual([
      'Título',
      'Autores',
      'Valoración',
      'ISBN-13',
      'ISBN-10',
      'Acciones',
    ]);
  });

  it('repeats the authors under the title, for phones where their column is hidden', () => {
    const { rows } = render();

    const inline = (row: Element) => row.querySelector('.mat-column-title .inline-authors');
    expect(inline(rows[0])?.textContent?.trim()).toBe('Alex Shishin, Otra Autora');
    expect(inline(rows[1])?.textContent?.trim()).toBe('Autor desconocido');
  });

  it('fills in the optional data the book does not have', () => {
    const { rows } = render();

    expect(rows[1].textContent).toContain('Autor desconocido');
    expect(rows[1].querySelector('[aria-label="Sin valorar"]')).not.toBeNull();
    expect(rows[1].querySelector('[aria-label="Sin ISBN-10"]')).not.toBeNull();
  });

  describe('tooltips of the cut texts', () => {
    // jsdom has no layout: the widths are faked to simulate a text that does or does not fit
    function hover(selector: string, scrollWidth: number, clientWidth: number) {
      const { fixture, rows } = render();
      const text = rows[0].querySelector<HTMLElement>(selector)!;
      Object.defineProperty(text, 'scrollWidth', { value: scrollWidth });
      Object.defineProperty(text, 'clientWidth', { value: clientWidth });
      text.dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      return fixture.debugElement.query((de) => de.nativeElement === text).injector.get(MatTooltip);
    }

    it('shows the full title when it is cut', () => {
      const tooltip = hover('button.open', 400, 240);

      expect(tooltip.message).toBe('Rossiya');
      expect(tooltip.disabled).toBe(false);
    });

    it('stays hidden when the title fits', () => {
      expect(hover('button.open', 120, 240).disabled).toBe(true);
    });

    it('shows the full authors when they are cut', () => {
      const tooltip = hover('.mat-column-authors .truncate', 400, 200);

      expect(tooltip.message).toBe('Alex Shishin, Otra Autora');
      expect(tooltip.disabled).toBe(false);
    });

    it('stays hidden when the authors fit', () => {
      expect(hover('.mat-column-authors .truncate', 120, 200).disabled).toBe(true);
    });
  });

  it('does not show the covers by default', () => {
    const { element } = render();

    expect(headers(element)).not.toContain('Portada');
    expect(element.querySelector('img, .placeholder')).toBeNull();
  });

  it('shows the covers, or a placeholder without one, when asked to', () => {
    const { element, rows } = render({ showCover: true });

    expect(headers(element)[0]).toBe('Portada');
    expect(rows[0].querySelector('img')?.getAttribute('src')).toBe(book.bookCoverUrl);
    expect(rows[1].querySelector('img')).toBeNull();
    expect(rows[1].querySelector('.placeholder')).not.toBeNull();
  });

  it('shows a placeholder when a cover fails to load', () => {
    const { fixture, rows } = render({ showCover: true });

    rows[0].querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(rows[0].querySelector('img')).toBeNull();
    expect(rows[0].querySelector('.placeholder')).not.toBeNull();
  });

  it('asks to open a book through its title button, once', () => {
    const { rows, open, remove } = render();

    rows[1].querySelector<HTMLButtonElement>('button.open')!.click();

    expect(open).toHaveBeenCalledExactlyOnceWith(other);
    expect(remove).not.toHaveBeenCalled();
  });

  it('asks to open a book when clicking anywhere on its row', () => {
    const { rows, open } = render();

    rows[0].querySelector<HTMLElement>('.mat-column-isbn')!.click();

    expect(open).toHaveBeenCalledExactlyOnceWith(book);
  });

  it('asks to remove a book through a labelled button, without opening it', () => {
    const { rows, open, remove } = render();
    const button = rows[0].querySelector<HTMLButtonElement>('[aria-label^="Quitar"]')!;

    button.click();

    expect(button.getAttribute('aria-label')).toBe('Quitar Rossiya de la biblioteca');
    expect(remove).toHaveBeenCalledExactlyOnceWith(book);
    expect(open).not.toHaveBeenCalled();
  });

  it('does not offer adding a book to libraries by default', () => {
    const { element } = render();

    expect(element.querySelector('[aria-label^="Añadir"]')).toBeNull();
  });

  it('asks to add a book to libraries through a labelled button, without opening it', () => {
    const { rows, open, add } = render({ addable: true });
    const button = rows[0].querySelector<HTMLButtonElement>('[aria-label^="Añadir"]')!;

    button.click();

    expect(button.getAttribute('aria-label')).toBe('Añadir a otra biblioteca: Rossiya');
    expect(add).toHaveBeenCalledExactlyOnceWith(book);
    expect(open).not.toHaveBeenCalled();
    // Next to the trash button, in a wider column
    expect(rows[0].querySelector('[aria-label^="Quitar"]')).not.toBeNull();
    expect(rows[0].querySelector('.mat-column-actions')?.classList).toContain('two');
  });

  it('offers adding without removing, with its own label', () => {
    const { element, rows } = render({
      addable: true,
      removable: false,
      addLabel: 'Añadir a mis bibliotecas',
    });

    expect(element.querySelector('[aria-label^="Quitar"]')).toBeNull();
    expect(rows[0].querySelector('[aria-label^="Añadir"]')?.getAttribute('aria-label')).toBe(
      'Añadir a mis bibliotecas: Rossiya',
    );
    expect(rows[0].querySelector('.mat-column-actions')?.classList).not.toContain('two');
  });

  it('shows the library count instead of removing when the list spans several libraries', () => {
    const { element, rows } = render({ removable: false, showLibraryCount: true });

    expect(headers(element)).toContain('Bibliotecas');
    expect(headers(element)).not.toContain('Acciones');
    expect(rows[0].textContent).toContain('1 biblioteca');
    expect(rows[1].textContent).toContain('2 bibliotecas');
    expect(element.querySelector('[aria-label^="Quitar"]')).toBeNull();
  });

  describe('with the ratings of several people', () => {
    const { rating, libraries, ...shared } = book;

    function renderShared(raters: string[], ratings: PersonRating[]) {
      const fixture = TestBed.createComponent(UserBooksTable);
      fixture.componentRef.setInput('books', [{ ...shared, ratings }]);
      fixture.componentRef.setInput('raters', raters);
      fixture.componentRef.setInput('removable', false);
      fixture.detectChanges();
      return { fixture, element: fixture.nativeElement as HTMLElement };
    }

    const ana: PersonRating = { name: 'Ana', own: false, value: 9 };
    const own: PersonRating = { name: 'Tú', own: true, value: 7 };

    it('shows a column per person, and another with all of them for narrow frames', () => {
      const { element } = renderShared(['Ana', 'Tú'], [ana, own]);

      expect(headers(element)).toEqual([
        'Título',
        'Autores',
        'Ana',
        'Tú',
        'Valoraciones',
        'ISBN-13',
        'ISBN-10',
      ]);
      const labels = (selector: string) =>
        Array.from(element.querySelectorAll(`td${selector} app-rating-value`), (item) =>
          item.getAttribute('aria-label'),
        );
      const both = ['Valoración de Ana: 9 de 10', 'Tu valoración: 7 de 10'];
      expect(labels('.rater')).toEqual(both);
      expect(labels('.mat-column-ratings')).toEqual(both);
      // The names are in the headers, except where the ratings are stacked
      expect(element.querySelector('td.rater')?.textContent).not.toContain('Ana');
      expect(element.querySelector('td.mat-column-ratings')?.textContent).toContain('Ana');
    });

    it('needs no stacked column with a single person', () => {
      const { element } = renderShared(['Tú'], [own]);

      expect(headers(element)).toEqual(['Título', 'Autores', 'Tú', 'ISBN-13', 'ISBN-10']);
      expect(element.querySelector('.stackable')).toBeNull();
    });

    it('marks who has not rated the book', () => {
      const { element } = renderShared(['Ana', 'Tú'], [{ ...ana, value: null }, own]);

      const [anaCell, ownCell] = Array.from(element.querySelectorAll('td.rater'));
      expect(anaCell.querySelector('[aria-label="Sin valorar"]')).not.toBeNull();
      expect(ownCell.textContent).toContain('7/10');
      expect(element.querySelectorAll('td.mat-column-ratings app-rating-value')).toHaveLength(1);
    });

    it('follows the people to show', () => {
      const { fixture, element } = renderShared(['Ana', 'Tú'], [ana, own]);

      fixture.componentRef.setInput('books', [{ ...shared, ratings: [own] }]);
      fixture.componentRef.setInput('raters', ['Tú']);
      fixture.detectChanges();

      expect(headers(element)).toEqual(['Título', 'Autores', 'Tú', 'ISBN-13', 'ISBN-10']);
      expect(element.querySelector('td.rater app-rating-value')?.getAttribute('aria-label')).toBe(
        'Tu valoración: 7 de 10',
      );
    });
  });
});
