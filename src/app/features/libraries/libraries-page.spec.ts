import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { Tag } from '../tags/tag.model';
import { TagsService } from '../tags/tags.service';
import { LibraryCounts } from './libraries-section/library-counts';
import { LibrariesService } from './libraries.service';
import { LibrariesPage } from './libraries-page';
import { Library } from './library.model';
import { ShareLibraryDialog } from './share-library-dialog/share-library-dialog';

function library(
  id: string,
  name: string,
  books: string[] = [],
  isFavorite = false,
  tagIds: string[] = [],
): Library {
  return {
    id,
    name,
    description: `Descripción de ${name}`,
    books,
    isFavorite,
    shareRatings: false,
    tagIds,
    userId: 'u1',
    createdAt: '',
    updatedAt: '',
  };
}

/** The tags of the user, served without HTTP. */
function tagsStub(tags: Tag[] = []) {
  return { provide: TagsService, useValue: { listAll: () => of(tags) } };
}

describe('LibrariesPage', () => {
  async function render(items: Library[]) {
    TestBed.configureTestingModule({
      imports: [LibrariesPage],
      providers: [
        provideRouter([]),
        LibraryCounts,
        tagsStub(),
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
    expect(element.querySelector('.status .create')?.textContent).toContain('Nueva biblioteca');
  });

  it('links to the shared libraries when there are only those', async () => {
    const element = await render([]);
    const link = () => element.querySelector('.status a');
    expect(link()).toBeNull();

    TestBed.inject(LibraryCounts).shared.set(2);
    TestBed.tick();

    expect(link()?.getAttribute('href')).toBe('/libraries/shared');
  });

  it('sets its number on the tab, and removes it if the list cannot be loaded', async () => {
    await render([library('1', 'Novela'), library('2', 'Ensayo')]);
    const counts = TestBed.inject(LibraryCounts);
    expect(counts.own()).toBe(2);

    vi.spyOn(TestBed.inject(LibrariesService), 'list').mockReturnValue(
      throwError(() => new Error('down')),
    );
    TestBed.createComponent(LibrariesPage);

    expect(counts.own()).toBeNull();
  });

  it('does not change the number once it is closed', async () => {
    await render([library('1', 'Novela')]);
    const counts = TestBed.inject(LibraryCounts);
    const response = new Subject<{ items: Library[]; total: number }>();
    vi.spyOn(TestBed.inject(LibrariesService), 'list').mockReturnValue(response);
    const fixture = TestBed.createComponent(LibrariesPage);

    fixture.destroy();
    response.next({ items: [], total: 9 });

    expect(counts.own()).toBe(1);
  });

  it('opens the dialog to share a library', async () => {
    const item = library('1', 'Novela');
    const element = await render([item]);
    const open = vi
      .spyOn(TestBed.inject(MatDialog), 'open')
      .mockReturnValue({} as MatDialogRef<unknown>);

    element.querySelector<HTMLButtonElement>('[aria-label="Compartir Novela"]')!.click();

    expect(open).toHaveBeenCalledWith(ShareLibraryDialog, expect.objectContaining({ data: item }));
  });

  it('shows the create button in the filters row when there are libraries', async () => {
    const element = await render([library('1', 'Novela', ['a'])]);

    expect(element.querySelector('.filters .create')?.textContent).toContain('Nueva biblioteca');
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
        providers: [
          provideRouter([]),
          LibraryCounts,
          tagsStub(),
          { provide: LibrariesService, useValue: { list } },
        ],
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
      await wait();
      return { element, list, router, wait };
    }

    const all = [library('1', 'Novela'), library('2', 'Ensayo')];
    const byName = (search: string) =>
      all.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

    it('follows a new search in the URL, typed in the header of «Bibliotecas»', async () => {
      const { element, list, router, wait } = await setup(byName);
      expect(list).toHaveBeenCalledTimes(1);

      await router.navigateByUrl('/?q=nov');
      await wait();

      expect(list).toHaveBeenCalledTimes(2);
      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: 'nov',
        favorites: false,
        tagIds: [],
      });
      expect(element.querySelectorAll('.card').length).toBe(1);
      expect(TestBed.inject(LibraryCounts).own()).toBe(1);
    });

    it('restores the search from the URL', async () => {
      const { element, list } = await setup(byName, '/?q=ensayo');

      expect(list).toHaveBeenCalledTimes(1);
      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: 'ensayo',
        favorites: false,
        tagIds: [],
      });
      expect(element.querySelectorAll('.card').length).toBe(1);
    });

    it('follows URL changes such as back/forward', async () => {
      const { list, router, wait } = await setup(byName, '/?q=nov');

      await router.navigateByUrl('/');
      await wait();

      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: '',
        favorites: false,
        tagIds: [],
      });
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
      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: '',
        favorites: false,
        tagIds: [],
      });
      expect(element.querySelectorAll('.card').length).toBe(2);
      expect(list).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['', '/?q=viajes'],
      [' and filters', '/?q=viajes&favorites=true'],
    ])('offers the shared libraries that match a search%s without results', async (_, url) => {
      const { element, wait } = await setup(() => [], url);
      const link = () => element.querySelector('.status a');
      expect(link()).toBeNull();

      TestBed.inject(LibraryCounts).shared.set(2);
      await wait();
      expect(link()?.textContent?.trim()).toBe('Ver 2 en compartidas conmigo');
      expect(link()?.getAttribute('href')).toBe('/libraries/shared?q=viajes');

      TestBed.inject(LibraryCounts).shared.set(0);
      await wait();
      expect(link()).toBeNull();
    });

    it('does not offer the shared libraries for the filters alone', async () => {
      const { element, wait } = await setup(() => [], '/?favorites=true&tags=t1');
      TestBed.inject(LibraryCounts).shared.set(2);
      await wait();

      expect(element.textContent).toContain('Ninguna biblioteca coincide con los filtros');
      expect(element.querySelector('.status a')).toBeNull();
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
        providers: [
          provideRouter([]),
          LibraryCounts,
          tagsStub(),
          { provide: LibrariesService, useValue: { list } },
        ],
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
      expect(list).toHaveBeenLastCalledWith({
        skip: 12,
        limit: 12,
        search: '',
        favorites: false,
        tagIds: [],
      });
    });

    it('jumps to the last and the first page', async () => {
      const { element, list, router, wait } = await setup('/?page=2', () =>
        of({ items: [library('1', 'Novela')], total: 60 }),
      );

      element.querySelector<HTMLButtonElement>('button[aria-label="Última página"]')!.click();
      await wait();

      expect(router.url).toBe('/?page=5');
      expect(list).toHaveBeenLastCalledWith({
        skip: 48,
        limit: 12,
        search: '',
        favorites: false,
        tagIds: [],
      });

      element.querySelector<HTMLButtonElement>('button[aria-label="Primera página"]')!.click();
      await wait();

      expect(router.url).toBe('/');
      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: '',
        favorites: false,
        tagIds: [],
      });
    });

    it('keeps the paginator and the keyboard focus while the next page loads', async () => {
      const nextPage = new Subject<{ items: Library[]; total: number }>();
      const { element, wait } = await setup('/', (options) =>
        options.skip === 0 ? thirteen(options) : nextPage,
      );
      const paginator = element.querySelector('mat-paginator');
      const next = element.querySelector<HTMLButtonElement>(
        'button[aria-label="Página siguiente"]',
      )!;

      next.focus();
      next.click();
      await wait();

      expect(element.querySelector('mat-spinner')).not.toBeNull();
      expect(element.querySelector('mat-paginator')).toBe(paginator);
      expect(document.activeElement).toBe(next);

      nextPage.next({ items: [library('12', 'Novela')], total: 13 });
      await wait();

      expect(element.querySelector('mat-spinner')).toBeNull();
      expect(element.querySelector('mat-paginator')).toBe(paginator);
      expect(document.activeElement).toBe(next);
    });

    it('restores the page and its size from the URL', async () => {
      const { element, list } = await setup('/?page=2&limit=24', () =>
        of({ items: [library('1', 'Novela')], total: 60 }),
      );

      expect(list).toHaveBeenCalledTimes(1);
      expect(list).toHaveBeenCalledWith({
        skip: 24,
        limit: 24,
        search: '',
        favorites: false,
        tagIds: [],
      });
      expect(element.querySelector('.mat-mdc-paginator-range-label')?.textContent).toContain(
        '25 – 48 de 60',
      );
    });

    it('follows URL changes such as back/forward', async () => {
      const { list, router, wait } = await setup('/?page=2');

      await router.navigateByUrl('/');
      await wait();

      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: '',
        favorites: false,
        tagIds: [],
      });
    });

    it('falls back to the defaults on invalid values', async () => {
      const { list } = await setup('/?page=abc&limit=7');

      expect(list).toHaveBeenCalledWith({
        skip: 0,
        limit: 12,
        search: '',
        favorites: false,
        tagIds: [],
      });
    });

    it('goes to the last page when the URL points past the end', async () => {
      const { element, list, router } = await setup('/?page=9');

      expect(router.url).toBe('/?page=2');
      expect(list).toHaveBeenLastCalledWith({
        skip: 12,
        limit: 12,
        search: '',
        favorites: false,
        tagIds: [],
      });
      expect(element.querySelectorAll('.card').length).toBe(1);
    });
  });

  describe('favorites', () => {
    afterEach(() => vi.useRealTimers());

    const novela = library('1', 'Novela', [], true);
    const ensayo = library('2', 'Ensayo');

    async function setup(
      initialUrl = '/',
      options: { update?: ReturnType<typeof vi.fn>; items?: Library[] } = {},
    ) {
      vi.useFakeTimers();
      let items = options.items ?? [novela, ensayo];
      const list = vi.fn((params: { favorites?: boolean }) => {
        const found = params.favorites ? items.filter((item) => item.isFavorite) : items;
        return of({ items: found, total: found.length });
      });
      const update =
        options.update ??
        vi.fn((id: string, changes: { isFavorite: boolean }) => {
          items = items.map((item) => (item.id === id ? { ...item, ...changes } : item));
          return of(items.find((item) => item.id === id));
        });
      const openSnackBar = vi.fn();
      TestBed.configureTestingModule({
        imports: [LibrariesPage],
        providers: [
          provideRouter([]),
          LibraryCounts,
          tagsStub(),
          { provide: LibrariesService, useValue: { list, update } },
          { provide: MatSnackBar, useValue: { open: openSnackBar } },
        ],
      });
      const router = TestBed.inject(Router);
      await router.navigateByUrl(initialUrl);
      const fixture = TestBed.createComponent(LibrariesPage);
      const element = fixture.nativeElement as HTMLElement;
      const wait = async () => {
        await vi.advanceTimersByTimeAsync(0);
        fixture.detectChanges();
      };
      await wait();
      const chip = () => element.querySelector<HTMLElement>('mat-chip-option')!;
      return { element, list, update, openSnackBar, router, chip, wait };
    }

    it('filters by favorites from the chip and keeps it in the URL', async () => {
      const { element, list, router, chip, wait } = await setup('/?page=2&limit=24');

      expect(chip().textContent).toContain('Favoritas');
      chip().querySelector<HTMLElement>('[role="option"]')!.click();
      await wait();

      // A new filter starts again from the first page, keeping the page size
      expect(router.parseUrl(router.url).queryParams).toEqual({ limit: '24', favorites: 'true' });
      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 24,
        search: '',
        favorites: true,
        tagIds: [],
      });
      expect(element.querySelectorAll('.card').length).toBe(1);
      expect(TestBed.inject(LibraryCounts).own()).toBe(1);
    });

    it('restores the favorites filter from the URL', async () => {
      const { list, chip } = await setup('/?favorites=true');

      expect(list).toHaveBeenCalledTimes(1);
      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: '',
        favorites: true,
        tagIds: [],
      });
      expect(chip().querySelector('[role="option"]')?.getAttribute('aria-selected')).toBe('true');
    });

    it('keeps the filters visible and offers to show all when there are no favorites', async () => {
      const { element, router, chip, wait } = await setup('/?favorites=true', {
        items: [ensayo],
      });

      expect(element.textContent).toContain('Aún no tienes bibliotecas favoritas');
      expect(chip()).not.toBeNull();

      Array.from(element.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Ver todas'))!
        .click();
      await wait();

      expect(router.url).toBe('/');
      expect(element.querySelectorAll('.card').length).toBe(1);
    });

    it('marks a library as favorite and reloads the list without the spinner', async () => {
      const { element, list, update, openSnackBar, wait } = await setup();

      element
        .querySelector<HTMLButtonElement>('[aria-label="Marcar Ensayo como favorita"]')!
        .click();
      expect(element.querySelector('mat-spinner')).toBeNull();
      await wait();

      expect(update).toHaveBeenCalledWith('2', { isFavorite: true });
      expect(list).toHaveBeenCalledTimes(2);
      expect(openSnackBar).toHaveBeenCalledWith(
        '«Ensayo» marcada como favorita',
        undefined,
        expect.anything(),
      );
      const button = element.querySelector('[aria-label="Marcar Ensayo como favorita"]');
      expect(button?.getAttribute('aria-pressed')).toBe('true');
    });

    it('removes an unmarked library from the favorites list', async () => {
      const { element, update, wait } = await setup('/?favorites=true');

      element
        .querySelector<HTMLButtonElement>('[aria-label="Marcar Novela como favorita"]')!
        .click();
      await wait();

      expect(update).toHaveBeenCalledWith('1', { isFavorite: false });
      expect(element.textContent).toContain('Aún no tienes bibliotecas favoritas');
    });

    it('keeps the list and reports the error when the change fails', async () => {
      const { element, list, openSnackBar, wait } = await setup('/', {
        update: vi.fn(() => throwError(() => new Error('down'))),
      });

      element
        .querySelector<HTMLButtonElement>('[aria-label="Marcar Ensayo como favorita"]')!
        .click();
      await wait();

      expect(list).toHaveBeenCalledTimes(1);
      expect(element.querySelectorAll('.card').length).toBe(2);
      expect(openSnackBar).toHaveBeenCalledWith(
        'No se ha podido guardar el cambio. Inténtalo de nuevo.',
        undefined,
        expect.anything(),
      );
    });
  });

  describe('tags', () => {
    afterEach(() => vi.useRealTimers());

    const tag = (id: string, name: string, userId: string | null = 'u1'): Tag => ({
      id,
      name,
      color: 'green',
      userId,
      createdAt: '',
      updatedAt: '',
    });
    const novela = tag('t1', 'Novela');
    const prestados = tag('t2', 'Prestados');
    const clasicos = tag('t3', 'Clásicos', null);
    const novelaLibrary = library('1', 'Novela', [], false, ['t1', 't3']);
    const ensayoLibrary = library('2', 'Ensayo', [], false, ['t2']);

    async function setup(
      initialUrl = '/',
      options: { tags?: Tag[]; tagsAfterManaging?: Tag[] } = {},
    ) {
      vi.useFakeTimers();
      const items = [novelaLibrary, ensayoLibrary];
      const list = vi.fn((params: { tagIds?: string[] }) => {
        const found = items.filter((item) =>
          (params.tagIds ?? []).every((id) => item.tagIds.includes(id)),
        );
        return of({ items: found, total: found.length });
      });
      let tagsLoads = 0;
      const listAll = vi.fn(() => {
        tagsLoads++;
        return of(
          tagsLoads > 1 && options.tagsAfterManaging
            ? options.tagsAfterManaging
            : (options.tags ?? [clasicos, novela, prestados]),
        );
      });
      const openDialog = vi.fn(() => ({ afterClosed: () => of(undefined) }));
      TestBed.configureTestingModule({
        imports: [LibrariesPage],
        providers: [
          provideRouter([]),
          LibraryCounts,
          { provide: LibrariesService, useValue: { list } },
          { provide: TagsService, useValue: { listAll } },
          { provide: MatDialog, useValue: { open: openDialog } },
        ],
      });
      const router = TestBed.inject(Router);
      await router.navigateByUrl(initialUrl);
      const fixture = TestBed.createComponent(LibrariesPage);
      const element = fixture.nativeElement as HTMLElement;
      const wait = async () => {
        await vi.advanceTimersByTimeAsync(0);
        fixture.detectChanges();
      };
      await wait();
      /** Opens the tags dropdown and returns its options, rendered in the overlay. */
      const openTagSelect = async () => {
        element.querySelector<HTMLElement>('.tag-select .mat-mdc-select-trigger')!.click();
        await wait();
        return Array.from(document.querySelectorAll<HTMLElement>('.tag-select-panel mat-option'));
      };
      const option = (options: HTMLElement[], name: string) =>
        options.find((item) => item.textContent?.includes(name))!;
      const activeChips = () =>
        Array.from(element.querySelectorAll('.active-tags mat-chip')).map((chip) =>
          chip.textContent?.replace('cancel', '').trim(),
        );
      return {
        element,
        list,
        listAll,
        openDialog,
        router,
        openTagSelect,
        option,
        activeChips,
        wait,
      };
    }

    it('shows the tags of each library on its card, sorted by name', async () => {
      const { element } = await setup();

      const firstCard = element.querySelectorAll('app-library-card')[0];
      const badges = firstCard.querySelectorAll('app-tag-badge');
      expect(Array.from(badges).map((badge) => badge.textContent?.trim())).toEqual([
        'Clásicos',
        'Novela',
      ]);
    });

    it('lists the tags in a dropdown instead of one chip per tag', async () => {
      const { element, openTagSelect, activeChips } = await setup();

      // Only the favorites filter is a chip; no tag is selected yet
      expect(element.querySelectorAll('mat-chip-option').length).toBe(1);
      expect(activeChips()).toEqual([]);
      const options = await openTagSelect();
      expect(options.map((item) => item.textContent?.trim())).toEqual([
        'Clásicos',
        'Novela',
        'Prestados',
      ]);
    });

    it('filters by the tags chosen in the dropdown and keeps them in the URL', async () => {
      const { element, list, router, openTagSelect, option, activeChips, wait } =
        await setup('/?page=2');

      option(await openTagSelect(), 'Novela').click();
      await wait();

      expect(router.parseUrl(router.url).queryParams).toEqual({ tags: 't1' });
      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: '',
        favorites: false,
        tagIds: ['t1'],
      });
      expect(element.querySelectorAll('.card').length).toBe(1);
      expect(TestBed.inject(LibraryCounts).own()).toBe(1);
      expect(activeChips()).toEqual(['Novela']);

      // The panel stays open: a second tag is added to the first one
      option(
        Array.from(document.querySelectorAll('.tag-select-panel mat-option')),
        'Clásicos',
      ).click();
      await wait();

      expect(router.parseUrl(router.url).queryParams).toEqual({ tags: 't3,t1' });
      expect(activeChips()).toEqual(['Clásicos', 'Novela']);
    });

    it('restores the tag filter from the URL', async () => {
      const { element, list, activeChips } = await setup('/?tags=t2');

      expect(list).toHaveBeenCalledTimes(1);
      expect(list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: '',
        favorites: false,
        tagIds: ['t2'],
      });
      expect(activeChips()).toEqual(['Prestados']);
      expect(element.querySelector('.tag-select')?.textContent).toContain('Etiquetas (1)');
    });

    it('removes a tag from the filter with its chip', async () => {
      const { element, router, activeChips, wait } = await setup('/?tags=t1,t2');

      element.querySelector<HTMLButtonElement>('[aria-label="Quitar el filtro Novela"]')!.click();
      await wait();

      expect(router.parseUrl(router.url).queryParams).toEqual({ tags: 't2' });
      expect(activeChips()).toEqual(['Prestados']);
    });

    it('does not allow selecting more tags than a library can have', async () => {
      const many = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => tag(id, `Tag ${id}`));
      const { openTagSelect, option } = await setup('/?tags=a,b,c,d,e', { tags: many });

      const options = await openTagSelect();
      expect(option(options, 'Tag f').getAttribute('aria-disabled')).toBe('true');
      expect(option(options, 'Tag a').getAttribute('aria-disabled')).toBe('false');
    });

    it('shows a no-results state that clears every filter', async () => {
      const { element, router, wait } = await setup('/?tags=t1,t2&q=nada');

      expect(element.textContent).toContain('Ninguna biblioteca coincide con los filtros');
      Array.from(element.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Quitar filtros'))!
        .click();
      await wait();

      expect(router.url).toBe('/');
    });

    it('reloads the tags after managing them and drops deleted ones from the filter', async () => {
      const { element, list, listAll, openDialog, router, wait } = await setup('/?tags=t1,t2', {
        tagsAfterManaging: [clasicos, prestados],
      });

      Array.from(element.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Gestionar etiquetas'))!
        .click();
      await wait();

      expect(openDialog).toHaveBeenCalled();
      expect(listAll).toHaveBeenCalledTimes(2);
      expect(router.parseUrl(router.url).queryParams).toEqual({ tags: 't2' });
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ tagIds: ['t2'] }));
    });
  });
});
