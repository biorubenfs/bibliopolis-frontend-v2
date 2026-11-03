import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { LibrariesService } from './libraries.service';
import { LibrariesPage, SEARCH_DEBOUNCE_MS } from './libraries-page';
import { Library } from './library.model';

function library(id: string, name: string, books: string[] = []): Library {
  return {
    id,
    name,
    description: `Descripción de ${name}`,
    books,
    userId: 'u1',
    createdAt: '',
    updatedAt: '',
  };
}

describe('LibrariesPage', () => {
  async function render(items: Library[]) {
    TestBed.configureTestingModule({
      imports: [LibrariesPage],
      providers: [
        provideRouter([]),
        { provide: LibrariesService, useValue: { list: () => of({ items, total: items.length }) } },
      ],
    });
    const fixture = TestBed.createComponent(LibrariesPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a card for each library', async () => {
    const element = await render([
      library('1', 'Novela', ['a', 'b']),
      library('2', 'Ensayo', ['c']),
    ]);

    const cards = element.querySelectorAll('.card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Novela');
    expect(cards[0].textContent).toContain('2 libros');
    expect(cards[1].textContent).toContain('1 libro');
  });

  it('shows an empty state and the create button when there are no libraries', async () => {
    const element = await render([]);

    expect(element.textContent).toContain('Aún no tienes bibliotecas');
    expect(element.querySelector('.fab')?.textContent).toContain('Nueva biblioteca');
  });

  describe('search', () => {
    afterEach(() => vi.useRealTimers());

    async function setup(results: (search: string) => Library[], initialUrl = '/') {
      vi.useFakeTimers();
      const list = vi.fn((options: { search?: string }) => {
        const items = results(options.search ?? '');
        return of({ items, total: items.length });
      });
      TestBed.configureTestingModule({
        imports: [LibrariesPage],
        providers: [provideRouter([]), { provide: LibrariesService, useValue: { list } }],
      });
      const router = TestBed.inject(Router);
      await router.navigateByUrl(initialUrl);
      const fixture = TestBed.createComponent(LibrariesPage);
      const element = fixture.nativeElement as HTMLElement;

      /** Lets timers, pending navigations and change detection run. */
      const wait = async (ms = 0) => {
        await vi.advanceTimersByTimeAsync(ms);
        fixture.detectChanges();
      };
      const input = () =>
        element.querySelector<HTMLInputElement>('input[aria-label="Buscar bibliotecas"]');
      const type = (value: string) => {
        input()!.value = value;
        input()!.dispatchEvent(new Event('input'));
        fixture.detectChanges();
      };
      await wait();
      return { element, list, router, input, type, wait };
    }

    const all = [library('1', 'Novela'), library('2', 'Ensayo')];
    const byName = (search: string) =>
      all.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

    it('searches after the user stops typing and keeps the search in the URL', async () => {
      const { element, list, router, type, wait } = await setup(byName);
      expect(list).toHaveBeenCalledTimes(1);

      type('nov');
      await wait(SEARCH_DEBOUNCE_MS - 1);
      expect(list).toHaveBeenCalledTimes(1);

      await wait(1);
      expect(router.url).toBe('/?q=nov');
      expect(list).toHaveBeenCalledTimes(2);
      expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 12, search: 'nov' });
      expect(element.querySelectorAll('.card').length).toBe(1);
      expect(element.querySelector('.count')?.textContent).toContain('1 resultado');
    });

    it('restores the search from the URL', async () => {
      const { element, list, input } = await setup(byName, '/?q=ensayo');

      expect(list).toHaveBeenCalledTimes(1);
      expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 12, search: 'ensayo' });
      expect(input()?.value).toBe('ensayo');
      expect(element.querySelectorAll('.card').length).toBe(1);
    });

    it('follows URL changes made outside the field, such as back/forward', async () => {
      const { list, router, input, wait } = await setup(byName, '/?q=nov');

      await router.navigateByUrl('/');
      await wait();

      expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 12, search: '' });
      expect(input()?.value).toBe('');
    });

    it('shows a no-results state that clears the search and the URL', async () => {
      const { element, list, router, wait } = await setup(
        (search) => (search ? [] : all),
        '/?q=poes%C3%ADa',
      );
      expect(element.textContent).toContain('Ninguna biblioteca coincide con «poesía»');
      expect(element.textContent).not.toContain('Aún no tienes bibliotecas');

      const clear = Array.from(element.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Borrar búsqueda'),
      )!;
      clear.click();
      await wait();
      expect(router.url).toBe('/');
      expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 12, search: '' });
      expect(element.querySelectorAll('.card').length).toBe(2);

      // The cleared search is not re-applied when the debounce time passes
      await wait(SEARCH_DEBOUNCE_MS);
      expect(list).toHaveBeenCalledTimes(2);
    });

    it('hides the search field when the user has no libraries', async () => {
      const { input } = await setup(() => []);

      expect(input()).toBeNull();
    });
  });
});
