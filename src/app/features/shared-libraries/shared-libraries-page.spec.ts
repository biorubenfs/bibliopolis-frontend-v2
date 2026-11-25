import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

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
    sharedAt: '',
  };
}

describe('SharedLibrariesPage', () => {
  async function setup(
    options: { url?: string; list?: ReturnType<typeof vi.fn>; dialogResult?: unknown } = {},
  ) {
    const list =
      options.list ??
      vi.fn(() =>
        of({ items: [library('1', 'Novela', 'Ana'), library('2', 'Novela', 'Luis')], total: 2 }),
      );
    const openDialog = vi.fn(() => ({ afterClosed: () => of(options.dialogResult) }));
    const openSnackBar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'libraries/shared', component: SharedLibrariesPage }]),
        LibraryCounts,
        { provide: SharedLibrariesService, useValue: { list } },
        { provide: MatDialog, useValue: { open: openDialog } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
      ],
    });
    const harness = await RouterTestingHarness.create(options.url ?? '/libraries/shared');
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement as HTMLElement;
    return { harness, element, list, openDialog, openSnackBar };
  }

  it('shows the libraries with their owners', async () => {
    const { element, list } = await setup();

    expect(list).toHaveBeenCalledWith({ skip: 0, limit: 12, search: '' });
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

    expect(list).toHaveBeenCalledWith({ skip: 12, limit: 12, search: '' });
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

      expect(list).toHaveBeenCalledExactlyOnceWith({ skip: 12, limit: 12, search: 'ana' });
      expect(element.querySelector('input')?.value).toBe('ana');
      expect(TestBed.inject(LibraryCounts).shared()).toBe(13);
    });

    it('searches after the user stops typing, from the first page', async () => {
      const { harness, element, list } = await setup({
        url: '/libraries/shared?page=2',
        list: vi.fn(() => of({ items: [library('1', 'Novela', 'Ana')], total: 13 })),
      });
      const input = element.querySelector('input')!;

      input.value = 'ana';
      input.dispatchEvent(new Event('input'));
      await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2));
      await harness.fixture.whenStable();

      expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 12, search: 'ana' });
      expect(TestBed.inject(Router).url).toBe('/libraries/shared?q=ana');
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
      expect(element.querySelector('input')).not.toBeNull();

      element.querySelector<HTMLButtonElement>('.status button')!.click();
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/libraries/shared');
      expect(list).toHaveBeenLastCalledWith({ skip: 0, limit: 12, search: '' });
      expect(element.querySelectorAll('app-shared-library-card')).toHaveLength(1);
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
      const { element, list, openDialog, openSnackBar } = await leave(true);

      expect(openDialog).toHaveBeenCalledWith(
        LeaveLibraryDialog,
        expect.objectContaining({ data: library('2', 'Novela', 'Luis') }),
      );
      expect(list).toHaveBeenCalledTimes(2);
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
