import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterLink, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, Observable, Subject, of, throwError } from 'rxjs';

import { SEARCH_DEBOUNCE_MS } from '../../../core/lists/searchable-list';

import { PublicLibrariesService } from '../../public-libraries/public-libraries.service';
import { SharedLibrariesService } from '../../shared-libraries/shared-libraries.service';
import { LibrariesService } from '../libraries.service';
import { LibrariesSection } from './libraries-section';
import { LibraryCounts } from './library-counts';

type Result = Observable<{ items: unknown[]; total: number }>;

const total = (count: number): Result => of({ items: [], total: count });

@Component({ template: 'own <a routerLink="/libraries/shared">other</a>', imports: [RouterLink] })
class OwnPage {
  readonly counts = inject(LibraryCounts);
}

@Component({ template: 'shared' })
class SharedPage {}

@Component({ template: 'public' })
class PublicPage {}

@Component({ template: 'detail' })
class DetailPage {}

describe('LibrariesSection', () => {
  async function setup(
    url: string,
    options: { own?: () => Result; shared?: () => Result; public?: () => Result } = {},
  ) {
    const listOwn = vi.fn((_options: object) => (options.own ?? (() => total(12)))());
    const listShared = vi.fn((_options: object) => (options.shared ?? (() => total(3)))());
    const listPublic = vi.fn((_options: object) => (options.public ?? (() => total(5)))());
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'libraries',
            component: LibrariesSection,
            children: [
              { path: '', pathMatch: 'full', component: OwnPage },
              { path: 'shared', component: SharedPage },
              { path: 'public', component: PublicPage },
            ],
          },
          { path: 'libraries/:id', component: DetailPage },
        ]),
        { provide: LibrariesService, useValue: { list: listOwn } },
        { provide: SharedLibrariesService, useValue: { list: listShared } },
        { provide: PublicLibrariesService, useValue: { list: listPublic } },
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    const root = harness.fixture.nativeElement as HTMLElement;
    document.body.append(root);
    const settle = async () => {
      await harness.fixture.whenStable();
      harness.detectChanges();
    };
    await settle();
    const tabs = () => Array.from(root.querySelectorAll<HTMLAnchorElement>('a[role="tab"]'));
    return {
      harness,
      root,
      router: TestBed.inject(Router),
      listOwn,
      listShared,
      listPublic,
      tabs,
      settle,
      labels: () => tabs().map((tab) => tab.textContent!.replace(/\s+/g, ' ').trim()),
      selected: () => tabs().map((tab) => tab.getAttribute('aria-selected')),
      numbers: () => tabs().map((tab) => tab.querySelector('.count')?.textContent ?? null),
    };
  }

  afterEach(() => document.body.replaceChildren());

  it('marks the tab of the open page', async () => {
    const { root, selected, harness, settle } = await setup('/libraries');
    expect(selected()).toEqual(['true', 'false', 'false']);
    expect(root.querySelector('[role="tabpanel"]')?.textContent).toContain('own');

    await harness.navigateByUrl('/libraries/shared');
    await settle();

    expect(selected()).toEqual(['false', 'true', 'false']);
    expect(root.querySelector('[role="tabpanel"]')?.textContent).toContain('shared');

    await harness.navigateByUrl('/libraries/public');
    await settle();

    expect(selected()).toEqual(['false', 'false', 'true']);
    expect(root.querySelector('[role="tabpanel"]')?.textContent).toContain('public');
  });

  it('only asks for the numbers of the other tabs', async () => {
    const own = await setup('/libraries?q=nov');

    expect(own.listOwn).not.toHaveBeenCalled();
    expect(own.listShared).toHaveBeenCalledExactlyOnceWith({ skip: 0, limit: 1, search: 'nov' });
    expect(own.listPublic).toHaveBeenCalledExactlyOnceWith({ skip: 0, limit: 1, search: 'nov' });
    expect(own.numbers()).toEqual([null, '3', '5']);
    expect(own.labels()[1]).toContain(', 3 resultados');
    expect(own.labels()[2]).toContain(', 5 resultados');
  });

  it('counts the other tabs from «Públicas»', async () => {
    const { listOwn, listShared, listPublic, labels, numbers } =
      await setup('/libraries/public?q=nov');

    expect(listOwn).toHaveBeenCalledExactlyOnceWith({ skip: 0, limit: 1, search: 'nov' });
    expect(listShared).toHaveBeenCalledExactlyOnceWith({ skip: 0, limit: 1, search: 'nov' });
    expect(listPublic).not.toHaveBeenCalled();
    expect(numbers()).toEqual(['12', '3', null]);
    expect(labels()[2]).toBe('Públicas');
  });

  it('counts the own libraries with the search, without the filters', async () => {
    const { listOwn, listShared, numbers } = await setup(
      '/libraries/shared?q=nov&favorites=true&tags=t1&page=2',
    );

    expect(listOwn).toHaveBeenCalledTimes(1);
    expect(listOwn).toHaveBeenCalledWith({ skip: 0, limit: 1, search: 'nov' });
    expect(listShared).not.toHaveBeenCalled();
    expect(numbers()).toEqual(['12', null, '5']);
  });

  it('shows the number that the open page sets', async () => {
    const { harness, labels, numbers, settle } = await setup('/libraries');
    const page = harness.fixture.debugElement.query(By.directive(OwnPage));

    page.componentInstance.counts.own.set(1);
    await settle();

    expect(numbers()).toEqual(['1', '3', '5']);
    expect(labels()[0]).toContain(', 1 biblioteca');
    expect(labels()[0]).not.toContain('bibliotecas');
  });

  it('keeps the search and drops the rest when changing tabs', async () => {
    const { tabs, router, settle } = await setup('/libraries?q=nov&favorites=true&page=2');

    tabs()[1].click();
    await settle();
    expect(router.url).toBe('/libraries/shared?q=nov');

    tabs()[0].click();
    await settle();
    expect(router.url).toBe('/libraries?q=nov');
  });

  it('keeps the keyboard focus on the tabs', async () => {
    const { tabs, settle } = await setup('/libraries');
    const shared = tabs()[1];

    shared.focus();
    shared.click();
    await settle();

    expect(document.activeElement).toBe(shared);
    expect(tabs()[1]).toBe(shared);
  });

  it('moves the focus to the open tab when it was on a link of the replaced page', async () => {
    const { root, tabs, settle } = await setup('/libraries');
    expect(document.activeElement).toBe(document.body);
    const link = root.querySelector<HTMLAnchorElement>('[role="tabpanel"] a')!;

    link.focus();
    link.click();
    await settle();

    expect(document.activeElement).toBe(tabs()[1]);
  });

  it('counts again when the search changes, but not with the page', async () => {
    const { harness, listShared } = await setup('/libraries');

    await harness.navigateByUrl('/libraries?page=2');
    expect(listShared).toHaveBeenCalledTimes(1);

    await harness.navigateByUrl('/libraries?q=nov&page=2');
    expect(listShared).toHaveBeenCalledTimes(2);
  });

  it('ignores an outdated count', async () => {
    const first = new Subject<{ items: unknown[]; total: number }>();
    const results: Result[] = [first, total(1)];
    const { harness, numbers, settle } = await setup('/libraries', {
      shared: () => results.shift() ?? NEVER,
    });

    await harness.navigateByUrl('/libraries?q=nov');
    first.next({ items: [], total: 9 });
    await settle();

    expect(numbers()).toEqual([null, '1', '5']);
  });

  it('shows the tab without number if it cannot be counted, and counts again later', async () => {
    const results: Result[] = [throwError(() => new Error('down')), total(1)];
    const { harness, numbers, labels, settle } = await setup('/libraries', {
      shared: () => results.shift() ?? NEVER,
    });
    expect(numbers()).toEqual([null, null, '5']);
    expect(labels().slice(0, 2)).toEqual(['Mías', 'Compartidas conmigo']);

    await harness.navigateByUrl('/libraries?q=nov');
    await settle();

    expect(numbers()).toEqual([null, '1', '5']);
  });

  it('asks for nothing when leaving it', async () => {
    const { harness, root, listOwn, listShared, listPublic } = await setup('/libraries');

    await harness.navigateByUrl('/libraries/l1');

    expect(root.textContent).toContain('detail');
    expect(listOwn).not.toHaveBeenCalled();
    expect(listShared).toHaveBeenCalledTimes(1);
    expect(listPublic).toHaveBeenCalledTimes(1);
  });

  describe('search', () => {
    const input = (root: HTMLElement) => root.querySelector<HTMLInputElement>('.page-header input');
    const type = (root: HTMLElement, value: string) => {
      const field = input(root)!;
      field.value = value;
      field.dispatchEvent(new Event('input'));
    };
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    it('searches in the open tab once the user stops typing, from the first page', async () => {
      const { root, router, settle } = await setup('/libraries/shared?owner=u1&page=2&limit=24');

      type(root, 'ana');
      expect(router.url).toBe('/libraries/shared?owner=u1&page=2&limit=24');

      await vi.waitFor(() => expect(router.url).toContain('q=ana'));
      await settle();
      const url = router.parseUrl(router.url);
      expect(router.url.split('?')[0]).toBe('/libraries/shared');
      // The filters and the page size of the tab stay
      expect(url.queryParams).toEqual({ owner: 'u1', limit: '24', q: 'ana' });
    });

    it('does not lose the page when the search does not really change', async () => {
      const { root, router } = await setup('/libraries?page=2');

      type(root, '  ');
      await pause(SEARCH_DEBOUNCE_MS + 50);

      expect(router.url).toBe('/libraries?page=2');
    });

    it('restores it from the URL and follows the changes made outside the field', async () => {
      const { root, harness, settle } = await setup('/libraries?q=nov');
      expect(input(root)?.value).toBe('nov');

      // Such as back/forward or a button of the page that clears the search
      await harness.navigateByUrl('/libraries');
      await settle();

      expect(input(root)?.value).toBe('');
    });

    it('clears it with its button, keeping the filters', async () => {
      const { root, router, settle } = await setup('/libraries?q=nov&favorites=true&page=2');

      root
        .querySelector<HTMLButtonElement>('.page-header button[aria-label="Borrar búsqueda"]')!
        .click();
      await settle();

      expect(router.url).toBe('/libraries?favorites=true');
      expect(input(root)?.value).toBe('');
    });

    it('says what each tab searches', async () => {
      const { root, harness, settle } = await setup('/libraries');
      expect(input(root)?.getAttribute('aria-label')).toBe('Buscar bibliotecas');
      expect(input(root)?.placeholder).toBe('Nombre o descripción');

      await harness.navigateByUrl('/libraries/shared');
      await settle();

      expect(input(root)?.getAttribute('aria-label')).toBe(
        'Buscar bibliotecas compartidas conmigo',
      );
      expect(input(root)?.placeholder).toBe('Nombre, descripción o propietario');

      await harness.navigateByUrl('/libraries/public');
      await settle();

      expect(input(root)?.getAttribute('aria-label')).toBe('Buscar bibliotecas públicas');
      expect(input(root)?.placeholder).toBe('Nombre, descripción o propietario');
    });

    it('is hidden without libraries in any tab, but not with a filter', async () => {
      const { root, harness, settle } = await setup('/libraries', {
        shared: () => total(0),
        public: () => total(0),
      });
      const page = () => harness.fixture.debugElement.query(By.directive(OwnPage));

      page().componentInstance.counts.own.set(0);
      await settle();
      expect(input(root)).toBeNull();

      // With no results for a filter, the search stays, to change it
      await harness.navigateByUrl('/libraries?favorites=true');
      page().componentInstance.counts.own.set(0);
      await settle();
      expect(input(root)).not.toBeNull();
    });
  });
});
