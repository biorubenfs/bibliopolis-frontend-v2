import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

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
        provideRouter([{ path: 'shared-libraries', component: SharedLibrariesPage }]),
        { provide: SharedLibrariesService, useValue: { list } },
        { provide: MatDialog, useValue: { open: openDialog } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
      ],
    });
    const harness = await RouterTestingHarness.create(options.url ?? '/shared-libraries');
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement as HTMLElement;
    return { harness, element, list, openDialog, openSnackBar };
  }

  it('shows the libraries with their owners', async () => {
    const { element, list } = await setup();

    expect(list).toHaveBeenCalledWith({ skip: 0, limit: 12 });
    expect(element.querySelector('h1')?.textContent).toBe('Compartidas conmigo');
    expect(element.querySelector('.count')?.textContent).toBe('2 bibliotecas');
    const owners = Array.from(element.querySelectorAll('.owner'), (item) => item.textContent);
    expect(owners).toEqual(['De Ana', 'De Luis']);
  });

  it('explains that nothing is shared yet', async () => {
    const { element } = await setup({ list: vi.fn(() => of({ items: [], total: 0 })) });

    expect(element.textContent).toContain('Nadie ha compartido una biblioteca contigo');
    expect(element.querySelector('.count')).toBeNull();
    expect(element.querySelector('mat-paginator')).toBeNull();
  });

  it('requests the page in the URL', async () => {
    const { element, list } = await setup({
      url: '/shared-libraries?page=2',
      list: vi.fn(() => of({ items: [library('1', 'Novela', 'Ana')], total: 13 })),
    });

    expect(list).toHaveBeenCalledWith({ skip: 12, limit: 12 });
    expect(element.querySelector('mat-paginator')).not.toBeNull();
  });

  it('lets the user retry after a failure', async () => {
    const list = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error()))
      .mockReturnValue(of({ items: [library('1', 'Novela', 'Ana')], total: 1 }));
    const { harness, element } = await setup({ list });

    element.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await harness.fixture.whenStable();

    expect(element.querySelectorAll('app-shared-library-card')).toHaveLength(1);
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
      expect(document.activeElement).toBe(element.querySelector('h1'));
    });

    it('does nothing if it is cancelled', async () => {
      const { list, openSnackBar } = await leave(undefined);

      expect(list).toHaveBeenCalledTimes(1);
      expect(openSnackBar).not.toHaveBeenCalled();
    });
  });
});
