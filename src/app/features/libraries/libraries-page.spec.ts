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

  describe('pagination in the URL', () => {
    afterEach(() => vi.useRealTimers());

    /** 13 libraries: one page of 12 and a second page with the last one. */
    const thirteen = (options: { skip: number }) =>
      of({ items: options.skip < 13 ? [library(`${options.skip}`, 'Novela')] : [], total: 13 });

    async function setup(
      initialUrl: string,
      results: (options: { skip: number }) => ReturnType<typeof thirteen> = thirteen,
    ) {
      vi.useFakeTimers();
      const list = vi.fn(results);
      TestBed.configureTestingModule({
        imports: [LibrariesPage],
        providers: [provideRouter([]), { provide: LibrariesService, useValue: { list } }],
      });
      const router = TestBed.inject(Router);
      await router.navigateByUrl(initialUrl);
      const fixture = TestBed.createComponent(LibrariesPage);
      const wait = async (ms = 0) => {
        await vi.advanceTimersByTimeAsync(ms);
        fixture.detectChanges();
      };
      await wait();
      return { element: fixture.nativeElement as HTMLElement, fixture, list, router, wait };
    }

    it('keeps the page in the URL', async () => {
      const { element, list, router, wait } = await setup('/');

      element.querySelector<HTMLButtonElement>('button[aria-label="Página siguiente"]')!.click();
      await wait();

      expect(router.url).toBe('/?page=2');
      expect(list).toHaveBeenLastCalledWith({ skip: 12, limit: 12, search: '' });
    });

    it('restores the page and its size from the URL', async () => {
      const { element, list } = await setup('/?page=2&limit=24', () =>
        of({ items: [library('1', 'Novela')], total: 60 }),
      );

      expect(list).toHaveBeenCalledTimes(1);
      expect(list).toHaveBeenCalledWith({ skip: 24, limit: 24, search: '' });
      expect(element.querySelector('.mat-mdc-paginator-range-label')?.textContent).toContain(
        '25 – 48 de 60',
      );
    });

    it('follows URL changes such as back/forward', async () => {
      const { list, router, wait } = await setup('/?page=2');

      await router.navigateByUrl('/');
      await wait();

      expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 12, search: '' });
    });

    it('falls back to the defaults on invalid values', async () => {
      const { list } = await setup('/?page=abc&limit=7');

      expect(list).toHaveBeenCalledWith({ skip: 0, limit: 12, search: '' });
    });

    it('goes to the last page when the URL points past the end', async () => {
      const { element, list, router } = await setup('/?page=9');

      expect(router.url).toBe('/?page=2');
      expect(list).toHaveBeenLastCalledWith({ skip: 12, limit: 12, search: '' });
      expect(element.querySelectorAll('.card').length).toBe(1);
    });

    it('goes back to the first page on a new search, keeping the page size', async () => {
      const { element, fixture, list, router, wait } = await setup('/?page=2&limit=24', () =>
        of({ items: [library('1', 'Novela')], total: 60 }),
      );

      const input = element.querySelector<HTMLInputElement>(
        'input[aria-label="Buscar bibliotecas"]',
      )!;
      input.value = 'nov';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await wait(SEARCH_DEBOUNCE_MS);

      expect(router.parseUrl(router.url).queryParams).toEqual({ limit: '24', q: 'nov' });
      expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 24, search: 'nov' });
    });

    it('stays on the same page when the search does not really change', async () => {
      const { element, fixture, list, router, wait } = await setup('/?page=2');

      const input = element.querySelector<HTMLInputElement>(
        'input[aria-label="Buscar bibliotecas"]',
      )!;
      input.value = '  ';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await wait(SEARCH_DEBOUNCE_MS);

      expect(router.url).toBe('/?page=2');
      expect(list).toHaveBeenCalledTimes(1);
    });
  });
});
