import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/http/api-error';
import {
  BarcodeScannerService,
  ScannerCallbacks,
  ScannerError,
} from '../../books/barcode-scanner.service';
import { ExternalBook } from '../../books/external-book.model';
import { ExternalBooksService } from '../../books/external-books.service';
import { AddBookDialog } from '../add-book-dialog/add-book-dialog';
import { LibrariesService } from '../libraries.service';
import { ScanBooksDialog } from './scan-books-dialog';

const ISBN = '9780595385294';

const rossiya: ExternalBook = {
  title: 'Rossiya',
  isbn13: ISBN,
  isbn10: '059538529X',
  authors: ['Alex Shishin'],
  cover: { source: 'open_library', value: '1304487' },
  coverUrl: null,
};

/** The camera is replaced as a whole: these tests drive the dialog by feeding it readings. */
describe('ScanBooksDialog', () => {
  async function setup(
    options: {
      start?: ReturnType<typeof vi.fn>;
      findByIsbn?: ReturnType<typeof vi.fn>;
      torchAvailable?: boolean;
      manualResult?: string;
    } = {},
  ) {
    const session = {
      engine: 'native',
      torchAvailable: options.torchAvailable ?? false,
      setTorch: vi.fn(() => Promise.resolve()),
      stop: vi.fn(),
    };
    let callbacks!: ScannerCallbacks;
    const start =
      options.start ??
      vi.fn((_video: HTMLVideoElement, received: ScannerCallbacks) => {
        callbacks = received;
        return Promise.resolve(session);
      });
    const findByIsbn = options.findByIsbn ?? vi.fn(() => of(rossiya));
    const addBook = vi.fn(() => of({}));
    const close = vi.fn();
    const openDialog = vi.fn(() => ({ afterClosed: () => of(options.manualResult) }));

    TestBed.configureTestingModule({
      imports: [ScanBooksDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { libraryId: 'l1' } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: BarcodeScannerService, useValue: { start } },
        { provide: ExternalBooksService, useValue: { findByIsbn } },
        { provide: LibrariesService, useValue: { addBook } },
      ],
    });
    // MatDialogModule, imported by the component, has its own provider of MatDialog
    TestBed.overrideProvider(MatDialog, { useValue: { open: openDialog } });
    const fixture = TestBed.createComponent(ScanBooksDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const button = (text: string) =>
      Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
    const click = async (text: string) => {
      button(text)!.click();
      await fixture.whenStable();
    };
    /** A code has to be read twice in a row to be accepted. */
    const scan = async (isbn = ISBN) => {
      callbacks.onCodes([isbn]);
      callbacks.onCodes([isbn]);
      await fixture.whenStable();
    };

    return {
      element,
      fixture,
      session,
      start,
      findByIsbn,
      addBook,
      close,
      openDialog,
      button,
      click,
      scan,
      onError: (error: ScannerError) => callbacks.onError(error),
    };
  }

  it('starts the camera on the video element', async () => {
    const { element, start } = await setup();

    expect(start).toHaveBeenCalledExactlyOnceWith(
      element.querySelector('video'),
      expect.anything(),
    );
  });

  it('shows the preview of a scanned book and waits for the confirmation', async () => {
    const { element, scan, addBook, findByIsbn, button } = await setup();

    await scan();

    expect(findByIsbn).toHaveBeenCalledExactlyOnceWith(ISBN);
    expect(element.querySelector('.preview')?.textContent).toContain('Rossiya');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Rossiya');
    expect(button('Añadir')).toBeDefined();
    expect(addBook).not.toHaveBeenCalled();
  });

  it('adds the book on confirmation, with the camera still open', async () => {
    const { element, scan, click, addBook, session } = await setup();

    await scan();
    await click('Añadir');

    expect(addBook).toHaveBeenCalledExactlyOnceWith(
      'l1',
      expect.objectContaining({ isbn13: ISBN }),
    );
    expect(element.querySelector('.preview')).toBeNull();
    expect(element.textContent).toContain('«Rossiya» añadido');
    expect(session.stop).not.toHaveBeenCalled();
  });

  it('does not add a discarded book, nor bring it back while it is in front of the camera', async () => {
    const { element, scan, click, addBook, findByIsbn } = await setup();

    await scan();
    await click('Descartar');
    await scan();

    expect(addBook).not.toHaveBeenCalled();
    expect(findByIsbn).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.preview')).toBeNull();
  });

  it('does not call the backend for something that is not an ISBN', async () => {
    const { scan, findByIsbn } = await setup();

    await scan('8410000000009');

    expect(findByIsbn).not.toHaveBeenCalled();
  });

  it('turns the camera off on finishing, and on again to continue', async () => {
    const { scan, click, session, start, element } = await setup();

    await scan();
    await click('Añadir');
    await click('Terminar');

    expect(session.stop).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.summary')?.textContent).toContain('1 libro añadido');

    await click('Seguir escaneando');
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('closes with the number of books added', async () => {
    const { scan, click, close } = await setup();

    await scan();
    await click('Añadir');
    await click('Terminar');
    await click('Cerrar');

    expect(close).toHaveBeenCalledWith(1);
  });

  it('warns about books without confirmation before closing', async () => {
    const { element, scan, click } = await setup();

    await scan();
    await click('Terminar');

    expect(element.querySelector('.warning')).not.toBeNull();
  });

  it('turns the camera off when the dialog is destroyed', async () => {
    const { fixture, session } = await setup();

    fixture.destroy();

    expect(session.stop).toHaveBeenCalled();
  });

  it('stops a camera that finishes starting after the dialog is gone', async () => {
    const late = { stop: vi.fn(), torchAvailable: false };
    let finishStart: (value: typeof late) => void = () => undefined;
    const { fixture } = await setup({
      start: vi.fn(() => new Promise((resolve) => (finishStart = resolve))),
    });

    fixture.destroy();
    finishStart(late);
    await Promise.resolve();
    await Promise.resolve();

    expect(late.stop).toHaveBeenCalled();
  });

  describe('camera errors', () => {
    it('explains a denied permission, offers the manual ISBN and allows retrying', async () => {
      const start = vi.fn(() => Promise.reject(new ScannerError('permission-denied')));
      const { element, button, click } = await setup({ start });

      expect(element.querySelector('[role="alert"]')?.textContent).toContain('permiso');
      expect(button('Escribir ISBN')).toBeDefined();

      await click('Reintentar');
      expect(start).toHaveBeenCalledTimes(2);
    });

    it('explains a problem that appears while scanning', async () => {
      const { element, fixture, onError, session } = await setup();

      onError(new ScannerError('camera-failed'));
      await fixture.whenStable();

      expect(element.querySelector('[role="alert"]')?.textContent).toContain('abrir la cámara');
      expect(session.stop).toHaveBeenCalled();
    });
  });

  describe('torch', () => {
    it('is not offered on a camera without one', async () => {
      const { element } = await setup();

      expect(element.querySelector('[aria-label*="linterna"]')).toBeNull();
    });

    it('toggles it, stating its state to screen readers', async () => {
      const { element, fixture, session } = await setup({ torchAvailable: true });
      const torch = () => element.querySelector<HTMLButtonElement>('[aria-label*="linterna"]')!;

      expect(torch().getAttribute('aria-pressed')).toBe('false');
      torch().click();
      await fixture.whenStable();

      expect(session.setTorch).toHaveBeenCalledWith(true);
      expect(torch().getAttribute('aria-pressed')).toBe('true');
      expect(torch().getAttribute('aria-label')).toBe('Apagar la linterna');
    });
  });

  describe('pending books', () => {
    const notFound = () => throwError(() => new ApiError(404, null, 'error'));

    it('completes a book nobody knows with the manual form and its ISBN', async () => {
      const { element, scan, click, openDialog } = await setup({
        findByIsbn: vi.fn(notFound),
        manualResult: 'Escrito a mano',
      });

      await scan();
      expect(element.textContent).toContain('Pendientes: 1');

      await click('Terminar');
      await click('Completar');

      expect(openDialog).toHaveBeenCalledWith(
        AddBookDialog,
        expect.objectContaining({ data: { libraryId: 'l1', isbn: ISBN } }),
      );
      expect(element.querySelector('.pending')).toBeNull();
      expect(element.querySelector('.summary')?.textContent).toContain('Escrito a mano');
    });

    it('offers retrying after an error', async () => {
      const findByIsbn = vi
        .fn()
        .mockImplementationOnce(() => throwError(() => new ApiError(500, null, 'error')))
        .mockImplementationOnce(() => of(rossiya));
      const { element, scan, click } = await setup({ findByIsbn });

      await scan();
      await click('Terminar');
      await click('Reintentar');

      expect(element.querySelector('.preview')?.textContent).toContain('Rossiya');
    });
  });

  it('counts a book typed by hand as added', async () => {
    const { click, close, openDialog } = await setup({ manualResult: 'Sin código' });

    await click('Escribir ISBN');
    await click('Terminar');
    await click('Cerrar');

    expect(openDialog).toHaveBeenCalledWith(
      AddBookDialog,
      expect.objectContaining({ data: { libraryId: 'l1', isbn: undefined } }),
    );
    expect(close).toHaveBeenCalledWith(1);
  });
});
