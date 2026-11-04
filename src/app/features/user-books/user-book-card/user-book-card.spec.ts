import { TestBed } from '@angular/core/testing';

import { UserBook } from '../user-book.model';
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
    expect(element.querySelector('.rating mat-icon')?.getAttribute('aria-label')).toBe(
      'Valoración',
    );
    expect(element.textContent).not.toContain('Muy recomendable');
    expect(element.textContent).toContain('ISBN-13: 9780595385294');
    expect(element.textContent).toContain('ISBN-10: 059538529X');
    expect(element.querySelector('img')?.getAttribute('src')).toBe(book.bookCoverUrl);
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
});
