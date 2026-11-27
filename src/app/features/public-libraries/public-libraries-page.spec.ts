import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { LibraryCounts } from '../libraries/libraries-section/library-counts';
import { SharedLibrariesService } from '../shared-libraries/shared-libraries.service';
import { PublicLibrariesPage } from './public-libraries-page';
import { PublicLibrariesService } from './public-libraries.service';
import { PublicLibrary } from './public-library.model';

function library(id: string, name: string, ownerName: string): PublicLibrary {
  return { id, name, description: null, ownerName, booksCount: 2, publishedAt: '' };
}

describe('PublicLibrariesPage', () => {
  async function setup(
    options: {
      url?: string;
      list?: ReturnType<typeof vi.fn>;
      exportLibrary?: ReturnType<typeof vi.fn>;
      ownCount?: number;
    } = {},
  ) {
    const list =
      options.list ??
      vi.fn(() =>
        of({ items: [library('1', 'Novela', 'Ana'), library('2', 'Ensayo', 'Luis')], total: 2 }),
      );
    const exportLibrary =
      options.exportLibrary ?? vi.fn(() => of({ blob: new Blob(['a,b']), filename: 'Novela.csv' }));
    const openSnackBar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'libraries/public', component: PublicLibrariesPage }]),
        LibraryCounts,
        { provide: PublicLibrariesService, useValue: { list } },
        { provide: SharedLibrariesService, useValue: { export: exportLibrary } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
      ],
    });
    if (options.ownCount !== undefined) {
      TestBed.inject(LibraryCounts).own.set(options.ownCount);
    }
    const harness = await RouterTestingHarness.create(options.url ?? '/libraries/public');
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement as HTMLElement;
    return { harness, element, list, exportLibrary, openSnackBar };
  }

  it('shows the libraries with their owners, linked under «Públicas»', async () => {
    const { element, list } = await setup();

    expect(list).toHaveBeenCalledWith({ skip: 0, limit: 12, search: '' });
    expect(TestBed.inject(LibraryCounts).public()).toBe(2);
    const owners = Array.from(element.querySelectorAll('.owner'), (item) => item.textContent);
    expect(owners).toEqual(['De Ana', 'De Luis']);
    const links = Array.from(element.querySelectorAll('h2 a'), (a) => a.getAttribute('href'));
    expect(links).toEqual(['/libraries/public/1', '/libraries/public/2']);
  });

  it('offers to download them but not to leave them', async () => {
    const { element } = await setup();

    expect(element.querySelector('[aria-label="Descargar Novela, de Ana"]')).not.toBeNull();
    expect(element.querySelector('[aria-label^="Salir"]')).toBeNull();
    expect(element.querySelector('app-public-badge')).toBeNull();
  });

  it('downloads a library as the shared ones do', async () => {
    const { element, exportLibrary } = await setup();

    element.querySelector<HTMLButtonElement>('[aria-label="Descargar Novela, de Ana"]')!.click();
    document.querySelector<HTMLButtonElement>('.mat-mdc-menu-item:last-child')!.click();

    expect(exportLibrary).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), 'csv');
  });

  it('tells when a download fails', async () => {
    const { element, openSnackBar } = await setup({
      exportLibrary: vi.fn(() => throwError(() => new Error('down'))),
    });

    element.querySelector<HTMLButtonElement>('[aria-label="Descargar Novela, de Ana"]')!.click();
    document.querySelector<HTMLButtonElement>('.mat-mdc-menu-item')!.click();

    expect(openSnackBar).toHaveBeenCalledWith(
      'No se ha podido descargar la biblioteca. Inténtalo de nuevo.',
      undefined,
      { duration: 4000 },
    );
  });

  it('explains that no library is public yet', async () => {
    const { element } = await setup({ list: vi.fn(() => of({ items: [], total: 0 })) });

    expect(element.textContent).toContain('Aún no hay bibliotecas públicas');
    expect(TestBed.inject(LibraryCounts).public()).toBe(0);
    expect(element.querySelector('mat-paginator')).toBeNull();
  });

  it('searches with the URL and offers the own libraries that match', async () => {
    const { element, list } = await setup({
      url: '/libraries/public?q=nov',
      list: vi.fn(() => of({ items: [], total: 0 })),
      ownCount: 2,
    });

    expect(list).toHaveBeenCalledWith({ skip: 0, limit: 12, search: 'nov' });
    expect(element.textContent).toContain('Ninguna biblioteca pública coincide con «nov»');
    const own = Array.from(element.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('en mis bibliotecas'),
    );
    expect(own?.textContent).toContain('Ver 2 en mis bibliotecas');
    expect(own?.getAttribute('href')).toBe('/libraries?q=nov');
  });

  it('requests the page in the URL', async () => {
    const { element, list } = await setup({
      url: '/libraries/public?page=2',
      list: vi.fn(() => of({ items: [library('1', 'Novela', 'Ana')], total: 13 })),
    });

    expect(list).toHaveBeenCalledWith({ skip: 12, limit: 12, search: '' });
    expect(element.querySelector('mat-paginator')).not.toBeNull();
  });

  it('lets the user retry after a failure, without a number on the tab', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of({ items: [library('1', 'Novela', 'Ana')], total: 1 }));
    const { harness, element } = await setup({ list });

    expect(element.textContent).toContain('No se han podido cargar las bibliotecas públicas');
    expect(TestBed.inject(LibraryCounts).public()).toBeNull();

    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await harness.fixture.whenStable();

    expect(element.querySelectorAll('app-shared-library-card')).toHaveLength(1);
    expect(TestBed.inject(LibraryCounts).public()).toBe(1);
  });
});
