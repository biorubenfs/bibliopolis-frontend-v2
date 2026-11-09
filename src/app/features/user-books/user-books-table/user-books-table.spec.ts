import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';

import { UserBook } from '../user-book.model';
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
    inputs: { removable?: boolean; showLibraryCount?: boolean; showCover?: boolean } = {},
  ) {
    const fixture = TestBed.createComponent(UserBooksTable);
    fixture.componentRef.setInput('books', [book, other]);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const open = vi.fn();
    const remove = vi.fn();
    fixture.componentInstance.openRequested.subscribe(open);
    fixture.componentInstance.removeRequested.subscribe(remove);
    return { fixture, element, open, remove, rows: element.querySelectorAll('tbody tr') };
  }

  function headers(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('th'), (th) => th.textContent!.trim());
  }

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

  describe('title tooltip', () => {
    // jsdom has no layout: the widths are faked to simulate a title that does or does not fit
    function hoverTitle(scrollWidth: number, clientWidth: number) {
      const { fixture, rows } = render();
      const title = rows[0].querySelector<HTMLButtonElement>('button.open')!;
      Object.defineProperty(title, 'scrollWidth', { value: scrollWidth });
      Object.defineProperty(title, 'clientWidth', { value: clientWidth });
      title.dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      return fixture.debugElement
        .query((de) => de.nativeElement === title)
        .injector.get(MatTooltip);
    }

    it('shows the full title when it is cut', () => {
      const tooltip = hoverTitle(400, 240);

      expect(tooltip.message).toBe('Rossiya');
      expect(tooltip.disabled).toBe(false);
    });

    it('stays hidden when the title fits', () => {
      expect(hoverTitle(120, 240).disabled).toBe(true);
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

  it('shows the library count instead of removing when the list spans several libraries', () => {
    const { element, rows } = render({ removable: false, showLibraryCount: true });

    expect(headers(element)).toContain('Bibliotecas');
    expect(headers(element)).not.toContain('Acciones');
    expect(rows[0].textContent).toContain('1 biblioteca');
    expect(rows[1].textContent).toContain('2 bibliotecas');
    expect(element.querySelector('[aria-label^="Quitar"]')).toBeNull();
  });
});
