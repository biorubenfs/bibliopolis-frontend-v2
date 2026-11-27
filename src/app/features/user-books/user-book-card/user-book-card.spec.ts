import { TestBed } from '@angular/core/testing';

import { PersonRating, UserBook } from '../user-book.model';
import { UserBookCard } from './user-book-card';

describe('UserBookCard', () => {
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

  function render(overrides: Partial<UserBook> = {}) {
    TestBed.configureTestingModule({ imports: [UserBookCard] });
    const fixture = TestBed.createComponent(UserBookCard);
    fixture.componentRef.setInput('book', { ...book, ...overrides });
    fixture.detectChanges();
    return fixture;
  }

  it('shows the book data', () => {
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelector('h2')?.textContent).toContain('Rossiya');
    expect(element.textContent).toContain('Alex Shishin, Otra Autora');
    expect(element.querySelector('.rating')?.textContent).toMatch(/star\s*8\/10\s*$/);
    expect(element.textContent).not.toContain('Valoración');
    expect(element.querySelector('.rating [role="img"]')?.getAttribute('aria-label')).toBe(
      'Valoración: 8 de 10',
    );
    expect(element.textContent).not.toContain('Muy recomendable');
    expect(element.textContent).toContain('ISBN-13: 9780595385294');
    expect(element.textContent).toContain('ISBN-10: 059538529X');
    expect(element.querySelector('img')?.getAttribute('src')).toBe(book.bookCoverUrl);
  });

  it('shows the reading status of the user, and nothing without it', () => {
    const read = render({ readingStatus: 'read' }).nativeElement as HTMLElement;
    expect(read.querySelector('app-reading-status-badge')?.getAttribute('aria-label')).toBe(
      'Leído',
    );
    TestBed.resetTestingModule();

    const without = render().nativeElement as HTMLElement;
    expect(without.querySelector('app-reading-status-badge')).toBeNull();
    expect(without.textContent).not.toContain('Sin estado');
  });

  it('asks to open the book through its title', () => {
    const fixture = render();
    const open = vi.fn();
    const remove = vi.fn();
    fixture.componentInstance.openRequested.subscribe(open);
    fixture.componentInstance.removeRequested.subscribe(remove);
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('h2 button')!.click();

    expect(open).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it('asks to remove the book through a labelled trash button, without opening it', () => {
    const fixture = render();
    const open = vi.fn();
    const remove = vi.fn();
    fixture.componentInstance.openRequested.subscribe(open);
    fixture.componentInstance.removeRequested.subscribe(remove);
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector<HTMLButtonElement>('[aria-label^="Quitar"]')!;

    button.click();

    expect(button.getAttribute('aria-label')).toContain('Rossiya');
    expect(button.textContent).toContain('delete');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('does not offer removing the book when it is not removable', () => {
    TestBed.configureTestingModule({ imports: [UserBookCard] });
    const fixture = TestBed.createComponent(UserBookCard);
    fixture.componentRef.setInput('book', book);
    fixture.componentRef.setInput('removable', false);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[aria-label^="Quitar"]')).toBeNull();
    expect(element.querySelector('h2 button')).not.toBeNull();
  });

  it('hides the library count by default', () => {
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelector('.libraries')).toBeNull();
  });

  it.each([
    [['l1'], 'En 1 biblioteca'],
    [['l1', 'l2', 'l3'], 'En 3 bibliotecas'],
  ])('shows how many libraries contain the book: %j', (libraries, label) => {
    TestBed.configureTestingModule({ imports: [UserBookCard] });
    const fixture = TestBed.createComponent(UserBookCard);
    fixture.componentRef.setInput('book', { ...book, libraries });
    fixture.componentRef.setInput('showLibraryCount', true);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.libraries')?.textContent).toContain(label);
  });

  it('does not offer editing on the card', () => {
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelector('[aria-label^="Editar"]')).toBeNull();
  });

  it('omits the optional data the book does not have', () => {
    const element = render({ bookAuthors: [], bookIsbn10: null, rating: null })
      .nativeElement as HTMLElement;

    expect(element.textContent).toContain('Autor desconocido');
    expect(element.textContent).not.toContain('ISBN-10');
    expect(element.querySelector('.rating')).toBeNull();
  });

  it('shows a placeholder when there is no cover', () => {
    const element = render({ bookCoverUrl: null }).nativeElement as HTMLElement;

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('.placeholder')).not.toBeNull();
  });

  it('shows a placeholder when the cover fails to load', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('.placeholder')).not.toBeNull();
  });

  it('shows the ratings of several people with their names, in place of the own one', () => {
    const fixture = render();
    const { rating, libraries, ...shared } = book;
    fixture.componentRef.setInput('book', {
      ...shared,
      ratings: [
        { name: 'Ana', own: false, value: 9 },
        { name: 'Tú', own: true, value: 7 },
      ],
    });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.rating')).toBeNull();
    const ratings = Array.from(element.querySelectorAll('.ratings app-rating-value'));
    expect(ratings.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Valoración de Ana: 9 de 10',
      'Tu valoración: 7 de 10',
    ]);
    expect(ratings[0].textContent).toContain('Ana');
    expect(ratings[1].textContent).toContain('Tú');
  });

  it('leaves out the people who have not rated the book', () => {
    const fixture = render();
    const { rating, libraries, ...shared } = book;
    const show = (ratings: PersonRating[]) => {
      fixture.componentRef.setInput('book', { ...shared, ratings });
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    const onlyOwn = show([
      { name: 'Ana', own: false, value: null },
      { name: 'Tú', own: true, value: 7 },
    ]);
    expect(onlyOwn.querySelectorAll('app-rating-value')).toHaveLength(1);
    expect(onlyOwn.textContent).not.toContain('Ana');

    const none = show([{ name: 'Tú', own: true, value: null }]);
    expect(none.querySelector('.ratings')).toBeNull();
  });
});
