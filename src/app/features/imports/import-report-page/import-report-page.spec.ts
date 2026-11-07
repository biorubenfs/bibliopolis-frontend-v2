import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import { AddBookDialog } from '../../libraries/add-book-dialog/add-book-dialog';
import { ImportCounts, ImportItem, LibraryImport } from '../import.model';
import { ImportsService } from '../imports.service';
import { IMPORT_POLL_INTERVAL_MS, ImportReportPage } from './import-report-page';

function job(status: LibraryImport['status'], counts: Partial<ImportCounts> = {}): LibraryImport {
  return {
    id: 'i1',
    userId: 'u1',
    libraryId: 'l1',
    fileName: 'libros.csv',
    status,
    createdAt: '',
    updatedAt: '',
    finishedAt: null,
    counts: {
      total: 8,
      processed: 8,
      queued: 0,
      added: 3,
      alreadyInLibrary: 2,
      duplicateInFile: 1,
      notFound: 2,
      invalidIsbn: 0,
      missingIsbn: 0,
      sourceError: 0,
      internalError: 0,
      pending: 2,
      retryable: 0,
      ...counts,
    },
  };
}

function item(changes: Partial<ImportItem> = {}): ImportItem {
  return {
    id: 'r1',
    importId: 'i1',
    row: 4,
    rawIsbn: '978-0-306-40615-7',
    isbn13: '9780306406157',
    outcome: 'not_found',
    bookTitle: null,
    resolution: null,
    pending: true,
    ...changes,
  };
}

describe('ImportReportPage', () => {
  async function setup(
    options: {
      get?: ReturnType<typeof vi.fn>;
      listItems?: ReturnType<typeof vi.fn>;
      updateItem?: ReturnType<typeof vi.fn>;
      retry?: ReturnType<typeof vi.fn>;
      listAllPending?: ReturnType<typeof vi.fn>;
      dialogResult?: unknown;
    } = {},
  ) {
    const get = options.get ?? vi.fn(() => of(job('completed')));
    const listItems = options.listItems ?? vi.fn(() => of({ items: [item()], total: 1 }));
    const updateItem = options.updateItem ?? vi.fn(() => of(item()));
    const retry = options.retry ?? vi.fn(() => of(job('queued')));
    const listAllPending = options.listAllPending ?? vi.fn(() => of([item()]));
    const openDialog = vi.fn(() => ({ afterClosed: () => of(options.dialogResult) }));
    const undo = new Subject<void>();
    const openSnackBar = vi.fn(() => ({ onAction: () => undo }));
    TestBed.configureTestingModule({
      imports: [ImportReportPage],
      providers: [
        provideRouter([]),
        {
          provide: ImportsService,
          useValue: { get, listItems, updateItem, retry, listAllPending },
        },
        { provide: MatDialog, useValue: { open: openDialog } },
        { provide: MatSnackBar, useValue: { open: openSnackBar } },
      ],
    });
    const fixture = TestBed.createComponent(ImportReportPage);
    fixture.componentRef.setInput('id', 'l1');
    fixture.componentRef.setInput('importId', 'i1');
    const element = fixture.nativeElement as HTMLElement;

    /** Lets timers and change detection run; the second pass covers what the first one starts. */
    const settle = async () => {
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
    };
    await settle();
    const button = (text: string) =>
      Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
    const click = async (text: string) => {
      button(text)!.click();
      await settle();
    };
    return {
      fixture,
      element,
      get,
      listItems,
      updateItem,
      retry,
      listAllPending,
      openDialog,
      openSnackBar,
      undo,
      button,
      click,
      settle,
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('progress', () => {
    it('shows the progress and that the page can be left', async () => {
      const { element } = await setup({
        get: vi.fn(() => of(job('running', { processed: 3, queued: 5 }))),
      });

      expect(element.querySelector('mat-progress-bar')).not.toBeNull();
      expect(element.textContent).toContain('3 de 8 filas procesadas');
      expect(element.textContent).toContain('Puedes salir de esta página');
      expect(element.querySelector('.summary')).toBeNull();
    });

    it('checks the progress periodically until it finishes, and then shows the report', async () => {
      const get = vi
        .fn()
        .mockReturnValueOnce(of(job('queued', { processed: 0, queued: 8 })))
        .mockReturnValueOnce(of(job('running', { processed: 4, queued: 4 })))
        .mockReturnValue(of(job('completed')));
      const { element, listItems, settle } = await setup({ get });
      expect(get).toHaveBeenCalledTimes(1);
      expect(listItems).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(IMPORT_POLL_INTERVAL_MS);
      await settle();
      expect(element.textContent).toContain('4 de 8 filas procesadas');

      await vi.advanceTimersByTimeAsync(IMPORT_POLL_INTERVAL_MS);
      await settle();
      expect(element.querySelector('.summary')).not.toBeNull();
      expect(listItems).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(IMPORT_POLL_INTERVAL_MS * 5);
      expect(get).toHaveBeenCalledTimes(3);
    });

    it('stops checking when it leaves the page', async () => {
      const get = vi.fn(() => of(job('running', { processed: 1, queued: 7 })));
      const { fixture } = await setup({ get });

      fixture.destroy();
      await vi.advanceTimersByTimeAsync(IMPORT_POLL_INTERVAL_MS * 5);

      expect(get).toHaveBeenCalledTimes(1);
    });

    it('stops checking on a 404 and says it does not exist', async () => {
      const get = vi.fn(() => throwError(() => new ApiError(404, null, 'import not found')));
      const { element } = await setup({ get });

      await vi.advanceTimersByTimeAsync(IMPORT_POLL_INTERVAL_MS * 5);

      expect(get).toHaveBeenCalledTimes(1);
      expect(element.textContent).toContain('No hemos encontrado esta importación');
    });

    it('treats the import of another user as if it did not exist', async () => {
      const { element } = await setup({
        get: vi.fn(() => throwError(() => new ApiError(403, null, 'import not found'))),
      });

      expect(element.textContent).toContain('No hemos encontrado esta importación');
    });

    it('stops on any other error and allows trying again', async () => {
      const get = vi
        .fn()
        .mockReturnValueOnce(throwError(() => new ApiError(500, null, 'error')))
        .mockReturnValue(of(job('completed')));
      const { element, click } = await setup({ get });
      await vi.advanceTimersByTimeAsync(IMPORT_POLL_INTERVAL_MS * 3);
      expect(get).toHaveBeenCalledTimes(1);
      expect(element.textContent).toContain('No se ha podido consultar');

      await click('Reintentar');

      expect(element.querySelector('.summary')).not.toBeNull();
    });

    it('announces only milestones and the end', async () => {
      const status = (element: HTMLElement) =>
        element.querySelector('[role="status"]')?.textContent;
      const get = vi
        .fn()
        .mockReturnValueOnce(of(job('running', { processed: 1, queued: 7 })))
        .mockReturnValueOnce(of(job('running', { processed: 2, queued: 6 })))
        .mockReturnValueOnce(of(job('running', { processed: 3, queued: 5 })))
        .mockReturnValue(of(job('completed')));
      const { element, settle } = await setup({ get });
      expect(status(element)).toContain('0 %');

      await vi.advanceTimersByTimeAsync(IMPORT_POLL_INTERVAL_MS);
      await settle();
      expect(status(element)).toContain('25 %');

      await vi.advanceTimersByTimeAsync(IMPORT_POLL_INTERVAL_MS);
      await settle();
      expect(status(element)).toContain('25 %');

      await vi.advanceTimersByTimeAsync(IMPORT_POLL_INTERVAL_MS);
      await settle();
      expect(status(element)).toContain('terminada');
    });
  });

  describe('report', () => {
    it('shows the summary, and the pending rows by default', async () => {
      const { element, listItems } = await setup();

      expect(element.querySelector('.summary')?.textContent).toMatch(/Añadidos\s*3/);
      expect(element.querySelector('.summary')?.textContent).toMatch(/Ya estaban\s*2/);
      expect(element.querySelector('.summary')?.textContent).toMatch(/Duplicados\s*1/);
      expect(element.querySelector('.summary')?.textContent).toMatch(/Pendientes\s*2/);
      expect(listItems).toHaveBeenCalledWith('i1', { skip: 0, limit: 12, pending: true });
      const row = element.querySelector('.item')!;
      expect(row.textContent).toContain('Fila 4');
      expect(row.textContent).toContain('978-0-306-40615-7');
      expect(row.textContent).toContain('No encontrado');
      expect(row.querySelector('.item-title')).toBeNull();
    });

    it('shows the title of the book that has been found', async () => {
      const { element } = await setup({
        listItems: vi.fn(() =>
          of({
            items: [item({ bookTitle: 'Rossiya', outcome: 'added', pending: false })],
            total: 1,
          }),
        ),
      });

      expect(element.querySelector('.item-title')?.textContent).toContain('Rossiya');
    });

    it('names the row in the labels of its buttons', async () => {
      const { button } = await setup();

      expect(button('Descartar')!.getAttribute('aria-label')).toBe('Descartar: 978-0-306-40615-7');
      expect(button('Añadir manualmente')!.getAttribute('aria-label')).toBe(
        'Añadir manualmente: 978-0-306-40615-7',
      );
    });

    it('shows a success message without pending rows, and all the rows', async () => {
      const { element, listItems } = await setup({
        get: vi.fn(() => of(job('completed', { pending: 0, notFound: 0 }))),
        listItems: vi.fn(() =>
          of({ items: [item({ outcome: 'added', pending: false })], total: 1 }),
        ),
      });

      expect(element.querySelector('.banner.success')?.textContent).toContain(
        'No queda nada pendiente',
      );
      expect(element.querySelector('.banner.success a')?.getAttribute('href')).toBe(
        '/libraries/l1',
      );
      expect(listItems).toHaveBeenCalledWith('i1', { skip: 0, limit: 12, pending: undefined });
      expect(element.querySelector('.item-actions')).toBeNull();
    });

    it('allows seeing all the rows with the filter', async () => {
      const { listItems, click } = await setup();
      listItems.mockClear();

      await click('Todas (8)');

      expect(listItems).toHaveBeenCalledExactlyOnceWith('i1', {
        skip: 0,
        limit: 12,
        pending: undefined,
        outcome: undefined,
      });
    });

    it.each([
      ['Añadidos (3)', 'added'],
      ['Ya estaban (2)', 'already_in_library'],
      ['Duplicados (1)', 'duplicate_in_file'],
    ])('allows seeing only the rows of «%s» with the filter', async (label, outcome) => {
      const { listItems, click } = await setup();
      listItems.mockClear();

      await click(label);

      expect(listItems).toHaveBeenCalledExactlyOnceWith('i1', {
        skip: 0,
        limit: 12,
        pending: undefined,
        outcome,
      });
    });

    it('explains a failed import and allows retrying it', async () => {
      const get = vi
        .fn()
        .mockReturnValueOnce(of(job('failed')))
        .mockReturnValue(of(job('completed')));
      const { element, click, retry } = await setup({ get });
      expect(element.querySelector('.banner.failure')?.textContent).toContain('interrumpido');

      await click('Reintentar la importación');

      expect(retry).toHaveBeenCalledWith('i1');
      expect(element.querySelector('.banner.failure')).toBeNull();
    });
  });

  describe('resolving rows', () => {
    it('adds a row by hand with its data, marks it as manual and reloads', async () => {
      const { click, openDialog, updateItem, listItems, get } = await setup({
        dialogResult: 'Un libro',
      });
      listItems.mockClear();
      get.mockClear();

      await click('Añadir manualmente');

      expect(openDialog).toHaveBeenCalledWith(
        AddBookDialog,
        expect.objectContaining({
          data: {
            libraryId: 'l1',
            isbn: '9780306406157',
          },
        }),
      );
      expect(updateItem).toHaveBeenCalledWith('i1', 'r1', 'manual');
      expect(listItems).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledTimes(1);
    });

    it('offers the original value of an invalid ISBN so that it can be corrected', async () => {
      const { click, openDialog } = await setup({
        listItems: vi.fn(() =>
          of({
            items: [item({ isbn13: null, rawIsbn: '9.78E+12', outcome: 'invalid_isbn' })],
            total: 1,
          }),
        ),
      });

      await click('Añadir manualmente');

      expect(openDialog.mock.calls[0]).toEqual([
        AddBookDialog,
        expect.objectContaining({ data: expect.objectContaining({ isbn: '9.78E+12' }) }),
      ]);
    });

    it('opens the dialog without an ISBN for a row without one', async () => {
      const { click, openDialog } = await setup({
        listItems: vi.fn(() =>
          of({
            items: [item({ isbn13: null, rawIsbn: null, outcome: 'missing_isbn' })],
            total: 1,
          }),
        ),
      });

      await click('Añadir manualmente');

      expect(openDialog.mock.calls[0]).toEqual([
        AddBookDialog,
        expect.objectContaining({ data: expect.objectContaining({ isbn: undefined }) }),
      ]);
    });

    it('does nothing if the dialog is cancelled', async () => {
      const { click, updateItem } = await setup();

      await click('Añadir manualmente');

      expect(updateItem).not.toHaveBeenCalled();
    });

    it('dismisses a row and allows undoing it from the notice', async () => {
      const { click, updateItem, openSnackBar, undo, settle } = await setup();

      await click('Descartar');

      expect(updateItem).toHaveBeenCalledWith('i1', 'r1', 'dismissed');
      expect(openSnackBar).toHaveBeenCalledWith(
        'Fila 4 descartada',
        'Deshacer',
        expect.objectContaining({ duration: 6000 }),
      );

      undo.next();
      await settle();

      expect(updateItem).toHaveBeenLastCalledWith('i1', 'r1', null);
    });

    it('allows undoing a dismissal from the full list', async () => {
      const { click, updateItem } = await setup({
        listItems: vi.fn(() =>
          of({ items: [item({ resolution: 'dismissed', pending: false })], total: 1 }),
        ),
      });

      await click('Deshacer');

      expect(updateItem).toHaveBeenCalledWith('i1', 'r1', null);
    });

    it('explains a row that reached the library another way', async () => {
      const { element } = await setup({
        listItems: vi.fn(() => of({ items: [item({ pending: false })], total: 1 })),
      });

      expect(element.querySelector('.item-outcome')?.textContent).toContain('Ya en la biblioteca');
    });

    it('explains that a row could not be updated', async () => {
      const { click, openSnackBar } = await setup({
        updateItem: vi.fn(() => throwError(() => new ApiError(500, null, 'error'))),
      });

      await click('Descartar');

      expect(openSnackBar).toHaveBeenCalledWith(
        'No se ha podido actualizar la fila. Inténtalo de nuevo.',
        undefined,
        expect.anything(),
      );
    });

    it('goes to the last page when resolving the only row of the last page', async () => {
      const listItems = vi.fn((_id: string, { skip }: { skip: number }) =>
        of(skip >= 12 ? { items: [], total: 12 } : { items: [item()], total: 12 }),
      );
      const { fixture, settle } = await setup({ listItems });
      const page = fixture.componentInstance as unknown as {
        pageIndex: { set(value: number): void };
        loadItems(): void;
      };
      listItems.mockClear();

      page.pageIndex.set(1);
      page.loadItems();
      await settle();

      expect(listItems).toHaveBeenLastCalledWith('i1', { skip: 0, limit: 12, pending: true });
    });
  });

  describe('retry and download', () => {
    it('offers retrying the rows with a technical error, and follows the import again', async () => {
      const get = vi
        .fn()
        .mockReturnValueOnce(of(job('completed', { retryable: 2, sourceError: 2 })))
        .mockReturnValue(of(job('running', { processed: 6, queued: 2 })));
      const { element, button, click, retry } = await setup({ get });
      expect(button('Reintentar 2 filas con error')).toBeDefined();

      await click('Reintentar 2 filas');

      expect(retry).toHaveBeenCalledWith('i1');
      expect(element.querySelector('mat-progress-bar')).not.toBeNull();
    });

    it('does not offer it when there is nothing to retry', async () => {
      const { button } = await setup();

      expect(button('filas con error')).toBeUndefined();
    });

    it('explains that it cannot retry while another import is active', async () => {
      const { click, openSnackBar } = await setup({
        get: vi.fn(() => of(job('completed', { retryable: 1, sourceError: 1 }))),
        retry: vi.fn(() =>
          throwError(() => new ApiError(409, 'IMPORT ALREADY ACTIVE', 'in english')),
        ),
      });

      await click('Reintentar 1 fila');

      expect(openSnackBar).toHaveBeenCalledWith(
        expect.stringContaining('en curso'),
        undefined,
        expect.anything(),
      );
    });

    it('downloads the pending rows as a CSV', async () => {
      const { click, listAllPending } = await setup();
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

      await click('Descargar pendientes');

      expect(listAllPending).toHaveBeenCalledWith('i1');
      expect(fileNames).toEqual(['pendientes-libros.csv']);
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it('does not offer the download without pending rows', async () => {
      const { button } = await setup({
        get: vi.fn(() => of(job('completed', { pending: 0 }))),
      });

      expect(button('Descargar pendientes')).toBeUndefined();
    });
  });
});
