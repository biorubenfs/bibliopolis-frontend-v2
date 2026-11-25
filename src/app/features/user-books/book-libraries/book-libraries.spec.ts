import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { LibrariesService } from '../../libraries/libraries.service';
import { Library } from '../../libraries/library.model';
import { BookLibraries } from './book-libraries';

function library(id: string, name: string): Library {
  return {
    id,
    name,
    description: '',
    userId: 'u1',
    books: [],
    isFavorite: false,
    shareRatings: false,
    tagIds: [],
    createdAt: '',
    updatedAt: '',
  };
}

describe('BookLibraries', () => {
  async function render(options: {
    libraryIds: string[];
    currentLibraryId?: string;
    list?: ReturnType<typeof vi.fn>;
  }) {
    const list =
      options.list ??
      vi.fn(() =>
        of({
          items: [library('l1', 'Novela'), library('l2', 'Préstamos')],
          total: 2,
        }),
      );
    TestBed.configureTestingModule({
      imports: [BookLibraries],
      providers: [
        // A matching route keeps a clicked link from failing to navigate after the test ends
        provideRouter([{ path: 'libraries/:id', children: [] }]),
        { provide: LibrariesService, useValue: { list } },
      ],
    });
    const fixture = TestBed.createComponent(BookLibraries);
    fixture.componentRef.setInput('libraryIds', options.libraryIds);
    if (options.currentLibraryId !== undefined) {
      fixture.componentRef.setInput('currentLibraryId', options.currentLibraryId);
    }
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const chips = () => Array.from(element.querySelectorAll<HTMLElement>('.chip'));
    // The «+N más» chip has no name, so the names come from the library chips only
    const names = () =>
      Array.from(element.querySelectorAll('.chip .name')).map((name) => name.textContent);
    return { fixture, element, list, chips, names };
  }

  it('asks for the libraries by id and links to each of them', async () => {
    const { list, chips, names } = await render({ libraryIds: ['l1', 'l2'] });

    expect(list).toHaveBeenCalledWith({ skip: 0, limit: 100, ids: ['l1', 'l2'] });
    expect(names()).toEqual(['Novela', 'Préstamos']);
    expect(chips().map((chip) => chip.getAttribute('href'))).toEqual([
      '/libraries/l1',
      '/libraries/l2',
    ]);
  });

  it('puts the current library first, marked instead of linked', async () => {
    const { chips } = await render({ libraryIds: ['l1', 'l2'], currentLibraryId: 'l2' });

    const [current, other] = chips();
    expect(current.tagName).toBe('SPAN');
    expect(current.textContent).toContain('Préstamos');
    expect(current.textContent).toContain('biblioteca actual');
    expect(other.getAttribute('href')).toBe('/libraries/l1');
  });

  it('folds the libraries beyond the third behind a chip that shows the rest', async () => {
    const list = vi.fn(() =>
      of({
        items: [
          library('l1', 'Novela'),
          library('l2', 'Préstamos'),
          library('l3', 'Leídos'),
          library('l4', 'Ensayo'),
          library('l5', 'Poesía'),
        ],
        total: 5,
      }),
    );
    const { fixture, element, names } = await render({
      libraryIds: ['l1', 'l2', 'l3', 'l4', 'l5'],
      list,
    });
    const more = () => element.querySelector<HTMLButtonElement>('button.more')!;

    expect(names()).toEqual(['Novela', 'Préstamos', 'Leídos']);
    expect(more().textContent?.trim()).toBe('+2 más');
    expect(more().getAttribute('aria-expanded')).toBe('false');

    more().click();
    await fixture.whenStable();

    expect(names()).toEqual(['Novela', 'Préstamos', 'Leídos', 'Ensayo', 'Poesía']);
    expect(more().textContent?.trim()).toBe('Mostrar menos');
    expect(more().getAttribute('aria-expanded')).toBe('true');

    more().click();
    await fixture.whenStable();

    expect(names()).toEqual(['Novela', 'Préstamos', 'Leídos']);
  });

  it('shows no folding chip when the libraries fit', async () => {
    const { element } = await render({ libraryIds: ['l1', 'l2'] });

    expect(element.querySelector('button.more')).toBeNull();
  });

  it('emits when the user follows a link', async () => {
    const { fixture, chips } = await render({ libraryIds: ['l1'] });
    const navigated = vi.fn();
    fixture.componentInstance.navigated.subscribe(navigated);

    chips()[0].click();
    await fixture.whenStable();

    expect(navigated).toHaveBeenCalled();
  });

  it('shows a message while loading and another when the request fails', async () => {
    const response = new Subject<never>();
    const { element, fixture } = await render({
      libraryIds: ['l1'],
      list: vi.fn(() => response),
    });
    expect(element.textContent).toContain('Cargando bibliotecas');

    response.error(new Error('down'));
    await fixture.whenStable();

    expect(element.textContent).toContain('No se han podido cargar las bibliotecas');
  });

  it('does not call the backend for a book without libraries', async () => {
    const { element, list } = await render({ libraryIds: [] });

    expect(list).not.toHaveBeenCalled();
    expect(element.textContent).toContain('No está en ninguna biblioteca');
  });

  it('copes with a failed request when retrying with other ids', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValueOnce(of({ items: [library('l3', 'Leídos')], total: 1 }));
    const { fixture, element, names } = await render({ libraryIds: ['l1'], list });
    expect(element.textContent).toContain('No se han podido cargar');

    fixture.componentRef.setInput('libraryIds', ['l3']);
    await fixture.whenStable();

    expect(names()).toEqual(['Leídos']);
  });
});
