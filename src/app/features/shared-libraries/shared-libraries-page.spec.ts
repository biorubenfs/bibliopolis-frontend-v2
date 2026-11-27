import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';

import { LibraryCounts } from '../libraries/libraries-section/library-counts';
import { LeaveLibraryDialog } from './leave-library-dialog/leave-library-dialog';
import { SharedLibrariesPage } from './shared-libraries-page';
import { SharedLibrariesService } from './shared-libraries.service';
import { SharedLibrary } from './shared-library.model';

function library(id: string, name: string, ownerName: string): SharedLibrary {
  return {
    id,
    name,
    description: null,
    ownerName,
    booksCount: 2,
    shareRatings: false,
    isPublic: false,
    access: 'member',
    sharedAt: '',
  };
}

const ana = { id: 'u1', name: 'Ana', librariesCount: 2 };
const luis = { id: 'u2', name: 'Luis', librariesCount: 1 };

describe('SharedLibrariesPage', () => {
  async function setup(
    options: {
      url?: string;
      list?: ReturnType<typeof vi.fn>;
      listOwners?: ReturnType<typeof vi.fn>;
      exportLibrary?: ReturnType<typeof vi.fn>;
      dialogResult?: unknown;
    } = {},
  ) {
    const list =
      options.list ??
      vi.fn(() =>
        of({ items: [library('1', 'Novela', 'Ana'), library('2', 'Novela', 'Luis')], total: 2 }),
      );
    const listOwners = options.listOwners ?? vi.fn(() => of([ana, luis]));
    const exportLibrary =
      options.exportLibrary ?? vi.fn(() => of({ blob: new Blob(['a,b']), filename: 'Novela.csv' }));
    const openDialog = vi.fn(() => ({ afterClosed: () => of(options.dialogResult) }));
    const openSnackBar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'libraries/shared', component: SharedLibrariesPage }]),
        LibraryCounts,
        { provide: SharedLibrariesService, useValue: { list, listOwners, export: exportLibrary } },
        { provide: MatDialog, useValue: { open: openDialog } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
      ],
    });
    const harness = await RouterTestingHarness.create(options.url ?? '/libraries/shared');
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement as HTMLElement;
    return { harness, element, list, listOwners, exportLibrary, openDialog, openSnackBar };
  }

  it('shows the libraries with their owners', async () => {
    const { element, list } = await setup();

    expect(list).toHaveBeenCalledWith({ skip: 0, limit: 12, search: '', ownerId: '' });
    expect(TestBed.inject(LibraryCounts).shared()).toBe(2);
    const owners = Array.from(element.querySelectorAll('.owner'), (item) => item.textContent);
    expect(owners).toEqual(['De Ana', 'De Luis']);
  });

  it('explains that nothing is shared yet', async () => {
    const { element } = await setup({ list: vi.fn(() => of({ items: [], total: 0 })) });

    expect(element.textContent).toContain('Nadie ha compartido una biblioteca contigo');
    expect(TestBed.inject(LibraryCounts).shared()).toBe(0);
    expect(element.querySelector('mat-paginator')).toBeNull();
    expect(element.querySelector('input')).toBeNull();
  });

  it('requests the page in the URL', async () => {
    const { element, list } = await setup({
      url: '/libraries/shared?page=2',
      list: vi.fn(() => of({ items: [library('1', 'Novela', 'Ana')], total: 13 })),
    });

    expect(list).toHaveBeenCalledWith({ skip: 12, limit: 12, search: '', ownerId: '' });
    expect(element.querySelector('mat-paginator')).not.toBeNull();
  });

  it('lets the user retry after a failure', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error()))
      .mockReturnValue(of({ items: [library('1', 'Novela', 'Ana')], total: 1 }));
    const { harness, element } = await setup({ list });
    const counts = TestBed.inject(LibraryCounts);
    expect(counts.shared()).toBeNull();

    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await harness.fixture.whenStable();

    expect(element.querySelectorAll('app-shared-library-card')).toHaveLength(1);
    expect(counts.shared()).toBe(1);
  });

  describe('search', () => {
    it('restores it from the URL and sets the number of results on the tab', async () => {
      const { element, list } = await setup({
        url: '/libraries/shared?q=ana&page=2',
        list: vi.fn(() => of({ items: [library('1', 'Novela', 'Ana')], total: 13 })),
      });

      expect(list).toHaveBeenCalledExactlyOnceWith({
        skip: 12,
        limit: 12,
        search: 'ana',
        ownerId: '',
      });
      expect(TestBed.inject(LibraryCounts).shared()).toBe(13);
    });

    it('follows a new search in the URL, typed in the header of «Bibliotecas»', async () => {
      const { harness, list } = await setup({
        list: vi.fn(() => of({ items: [library('1', 'Novela', 'Ana')], total: 13 })),
      });

      await harness.navigateByUrl('/libraries/shared?q=ana');

      expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 12, search: 'ana', ownerId: '' });
    });

    it('offers to clear it when nothing matches', async () => {
      const { harness, element, list } = await setup({
        url: '/libraries/shared?q=nada',
        list: vi.fn(({ search }: { search: string }) =>
          of(
            search ? { items: [], total: 0 } : { items: [library('1', 'Novela', 'Ana')], total: 1 },
          ),
        ),
      });
      expect(element.textContent).toContain('coincide con «nada»');
      expect(element.textContent).not.toContain('Nadie ha compartido');

      element.querySelector<HTMLButtonElement>('.status button')!.click();
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/libraries/shared');
      expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 12, search: '', ownerId: '' });
      expect(element.querySelectorAll('app-shared-library-card')).toHaveLength(1);
    });
  });

  it('offers the own libraries that match a search without results', async () => {
    const { harness, element } = await setup({
      url: '/libraries/shared?q=viajes',
      list: vi.fn(() => of({ items: [], total: 0 })),
    });
    const link = () => element.querySelector('.status a');
    expect(link()).toBeNull();

    TestBed.inject(LibraryCounts).own.set(1);
    await harness.fixture.whenStable();

    expect(link()?.textContent?.trim()).toBe('Ver 1 en mis bibliotecas');
    expect(link()?.getAttribute('href')).toBe('/libraries?q=viajes');
  });

  describe('owner', () => {
    /** Opens the menu of owners and returns its options, rendered in the overlay. */
    async function openOwners({ harness, element }: Awaited<ReturnType<typeof setup>>) {
      element.querySelector<HTMLElement>('.owner-select .mat-mdc-select-trigger')!.click();
      await harness.fixture.whenStable();
      return Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
    }
    const text = (item: Element | null) => item?.textContent?.replace(/\s+/g, ' ').trim();
    const url = () => TestBed.inject(Router).url;

    it('offers the owners with their libraries, and lists the ones of the chosen one', async () => {
      const page = await setup({ url: '/libraries/shared?q=nov&page=2' });
      const options = await openOwners(page);
      expect(options.map(text)).toEqual([
        'Todos',
        'Ana 2 , 2 bibliotecas',
        'Luis 1 , 1 biblioteca',
      ]);
      expect(text(options[1].querySelector('[aria-hidden="true"].owner-count'))).toBe('2');

      options[1].click();
      await page.harness.fixture.whenStable();

      // From the first page, and along with the search
      expect(url()).toBe('/libraries/shared?q=nov&owner=u1');
      expect(page.list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: 'nov',
        ownerId: 'u1',
      });
      expect(text(page.element.querySelector('.owner-select'))).toBe('Ana');
      expect(page.element.querySelector('.owner-filter.active')).not.toBeNull();
      expect(TestBed.inject(LibraryCounts).shared()).toBe(2);
    });

    it('restores the owner from the URL, with a single request, and lists all again', async () => {
      const page = await setup({ url: '/libraries/shared?owner=u2' });
      expect(page.list).toHaveBeenCalledExactlyOnceWith({
        skip: 0,
        limit: 12,
        search: '',
        ownerId: 'u2',
      });
      expect(text(page.element.querySelector('.owner-select'))).toBe('Luis');

      (await openOwners(page))[0].click();
      await page.harness.fixture.whenStable();

      expect(url()).toBe('/libraries/shared');
      expect(page.list).toHaveBeenLastCalledWith({
        skip: 0,
        limit: 12,
        search: '',
        ownerId: '',
      });
      expect(page.element.querySelector('.owner-filter.active')).toBeNull();
    });

    it('is not offered with a single owner, or if they cannot be loaded', async () => {
      const single = await setup({ listOwners: vi.fn(() => of([ana])) });
      expect(single.element.querySelector('.owner-select')).toBeNull();

      TestBed.resetTestingModule();
      const failed = await setup({ listOwners: vi.fn(() => throwError(() => new Error())) });
      expect(failed.element.querySelector('.owner-select')).toBeNull();
      expect(failed.element.querySelectorAll('app-shared-library-card')).toHaveLength(2);
    });

    it('is dropped from the URL if they no longer share anything', async () => {
      const response = new Subject<(typeof ana)[]>();
      const { harness, list } = await setup({
        url: '/libraries/shared?q=nov&owner=gone',
        listOwners: vi.fn(() => response),
      });

      response.next([ana, luis]);
      await harness.fixture.whenStable();

      expect(url()).toBe('/libraries/shared?q=nov');
      expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 12, search: 'nov', ownerId: '' });
    });

    it('clears the filters when nothing matches', async () => {
      const { harness, element, list } = await setup({
        url: '/libraries/shared?q=nada&owner=u1',
        list: vi.fn(() => of({ items: [], total: 0 })),
      });
      TestBed.inject(LibraryCounts).own.set(2);
      await harness.fixture.whenStable();
      expect(element.textContent).toContain('Ninguna biblioteca coincide con los filtros');
      expect(element.querySelector('.owner-select')).not.toBeNull();
      expect(element.querySelector('.status a')?.getAttribute('href')).toBe('/libraries?q=nada');

      element.querySelector<HTMLButtonElement>('.status button')!.click();
      await harness.fixture.whenStable();

      expect(url()).toBe('/libraries/shared');
      expect(element.querySelector('input')).toBeNull();
      expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 12, search: '', ownerId: '' });
    });

    it('does not offer the own libraries without a search: the owner does not apply to them', async () => {
      const { harness, element } = await setup({
        url: '/libraries/shared?owner=u1',
        list: vi.fn(() => of({ items: [], total: 0 })),
      });
      TestBed.inject(LibraryCounts).own.set(2);
      await harness.fixture.whenStable();

      expect(element.querySelector('.status a')).toBeNull();
    });
  });

  describe('export', () => {
    async function exportAs(format: string, exportLibrary?: ReturnType<typeof vi.fn>) {
      const result = await setup({ exportLibrary });
      document.body.append(result.harness.fixture.nativeElement);
      result.element
        .querySelector<HTMLButtonElement>('[aria-label="Descargar Novela, de Luis"]')!
        .click();
      await result.harness.fixture.whenStable();
      const item = Array.from(document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]')).find(
        (button) => button.textContent?.includes(format),
      );
      item!.click();
      await result.harness.fixture.whenStable();
      return result;
    }

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      document.body.replaceChildren();
    });

    it('downloads the file of the chosen library', async () => {
      const fileNames: string[] = [];
      vi.stubGlobal(
        'URL',
        Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }),
      );
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        fileNames.push(this.download);
      });

      const { exportLibrary, openSnackBar } = await exportAs('CSV');

      expect(exportLibrary).toHaveBeenCalledWith(library('2', 'Novela', 'Luis'), 'csv');
      expect(fileNames).toEqual(['Novela.csv']);
      expect(openSnackBar).not.toHaveBeenCalled();
    });

    it('reports a failed download', async () => {
      const { openSnackBar } = await exportAs(
        'PDF',
        vi.fn(() => throwError(() => new Error('down'))),
      );

      expect(openSnackBar.mock.calls[0][0]).toBe(
        'No se ha podido descargar la biblioteca. Inténtalo de nuevo.',
      );
    });
  });

  describe('leaving', () => {
    async function leave(dialogResult: unknown) {
      const result = await setup({ dialogResult });
      document.body.append(result.harness.fixture.nativeElement);
      result.element
        .querySelector<HTMLButtonElement>('[aria-label="Salir de Novela, de Luis"]')!
        .click();
      await result.harness.fixture.whenStable();
      return result;
    }

    afterEach(() => document.body.replaceChildren());

    it('reloads the list and keeps the focus on the page', async () => {
      const { element, list, listOwners, openDialog, openSnackBar } = await leave(true);

      expect(openDialog).toHaveBeenCalledWith(
        LeaveLibraryDialog,
        expect.objectContaining({ data: library('2', 'Novela', 'Luis') }),
      );
      expect(list).toHaveBeenCalledTimes(2);
      expect(listOwners).toHaveBeenCalledTimes(2);
      expect(openSnackBar.mock.calls[0][0]).toBe('Has salido de «Novela»');
      expect(document.activeElement).toBe(element.querySelector('section'));
    });

    it('does nothing if it is cancelled', async () => {
      const { list, openSnackBar } = await leave(undefined);

      expect(list).toHaveBeenCalledTimes(1);
      expect(openSnackBar).not.toHaveBeenCalled();
    });
  });
});
