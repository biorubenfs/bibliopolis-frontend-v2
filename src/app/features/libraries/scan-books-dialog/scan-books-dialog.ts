import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
  BarcodeScannerService,
  ScannerError,
  ScannerErrorKind,
  ScannerSession,
} from '../../books/barcode-scanner.service';
import { BookPreview } from '../../books/book-preview/book-preview';
import { ExternalBooksService } from '../../books/external-books.service';
import { IsbnReadFilter } from '../../books/isbn-barcode';
import { AddBookDialog, AddBookDialogData } from '../add-book-dialog/add-book-dialog';
import { LibrariesService } from '../libraries.service';
import { ScanQueue } from './scan-queue';

export interface ScanBooksDialogData {
  libraryId: string;
}

/** Scanning fills the screen on a phone: the camera needs the room and one hand is holding a book. */
export const SCAN_DIALOG_SIZE = {
  width: '100vw',
  height: '100dvh',
  maxWidth: '100vw',
  maxHeight: '100dvh',
  panelClass: 'scan-books-panel',
};

const CAMERA_ERRORS: Record<ScannerErrorKind, string> = {
  'permission-denied':
    'No tenemos permiso para usar la cámara. Actívalo en los ajustes del navegador para esta web y vuelve a intentarlo.',
  'no-camera': 'No hemos encontrado ninguna cámara en este dispositivo.',
  unsupported: 'Este navegador no permite usar la cámara desde esta página.',
  'camera-failed': 'No se ha podido abrir la cámara. Puede que otra aplicación la esté usando.',
  'engine-failed': 'No se ha podido cargar el lector de códigos de barras.',
};

/**
 * Catalogues a pile of books with the camera, which stays open between books. Nothing is added until
 * the user confirms the preview: a barcode can be misread. Closes with the number of books added.
 */
@Component({
  selector: 'app-scan-books-dialog',
  imports: [BookPreview, MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './scan-books-dialog.html',
  styleUrl: './scan-books-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanBooksDialog {
  private readonly scanner = inject(BarcodeScannerService);
  private readonly externalBooks = inject(ExternalBooksService);
  private readonly libraries = inject(LibrariesService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject<MatDialogRef<ScanBooksDialog, number>>(MatDialogRef);
  private readonly data = inject<ScanBooksDialogData>(MAT_DIALOG_DATA);

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly queue = new ScanQueue(this.data.libraryId, {
    findByIsbn: (isbn) => this.externalBooks.findByIsbn(isbn),
    addBook: (libraryId, book) => this.libraries.addBook(libraryId, book),
  });

  protected readonly phase = signal<'scanning' | 'summary'>('scanning');
  protected readonly cameraError = signal<string | null>(null);
  protected readonly torchAvailable = signal(false);
  protected readonly torchOn = signal(false);

  protected readonly currentBook = computed(() => {
    const current = this.queue.current();
    return current && current.status !== 'searching' ? current.book : null;
  });

  /** Announced by screen readers, for whom the preview appearing would otherwise go unnoticed. */
  protected readonly announcement = computed(() => {
    const current = this.queue.current();
    switch (current?.status) {
      case 'searching':
        return 'Buscando libro…';
      case 'review':
        return `Libro encontrado: ${current.book.title}. Confirma si quieres añadirlo.`;
      case 'adding':
        return 'Añadiendo libro…';
      default:
        return this.queue.notice() ?? '';
    }
  });

  protected readonly addedLabel = computed(() => {
    const count = this.queue.added().length;
    return count === 1 ? '1 libro añadido' : `${count} libros añadidos`;
  });

  private readonly readFilter = new IsbnReadFilter();
  private session: ScannerSession | null = null;
  /** Changes when the camera is requested or released, to spot a start nobody is waiting for. */
  private cameraRequest = 0;

  constructor() {
    // The video element has to exist before the camera can be attached to it
    afterNextRender(() => this.startCamera());
    inject(DestroyRef).onDestroy(() => {
      this.stopCamera();
      this.queue.destroy();
    });
  }

  protected async startCamera(): Promise<void> {
    const request = ++this.cameraRequest;
    this.cameraError.set(null);
    try {
      const session = await this.scanner.start(this.video().nativeElement, {
        onCodes: (values) => this.onCodes(values),
        onError: (error) => this.onCameraError(error),
      });
      // The user may have left while waiting for the camera or for the permission prompt
      if (request !== this.cameraRequest) {
        session.stop();
        return;
      }
      this.session = session;
      this.torchAvailable.set(session.torchAvailable);
    } catch (error) {
      if (request === this.cameraRequest) {
        this.onCameraError(error);
      }
    }
  }

  protected toggleTorch(): void {
    const on = !this.torchOn();
    this.torchOn.set(on);
    this.session?.setTorch(on);
  }

  protected finishScanning(): void {
    this.stopCamera();
    this.phase.set('summary');
  }

  protected continueScanning(): void {
    this.phase.set('scanning');
    this.startCamera();
  }

  /** The way out for a code that cannot be read, or for a book without a code. */
  protected openManualEntry(isbn?: string): void {
    this.dialog
      .open<AddBookDialog, AddBookDialogData, string>(AddBookDialog, {
        width: '520px',
        maxWidth: 'calc(100vw - 32px)',
        data: { libraryId: this.data.libraryId, isbn },
      })
      .afterClosed()
      .subscribe((title) => {
        if (title) {
          this.queue.addedManually(title, isbn);
        }
      });
  }

  protected close(): void {
    this.dialogRef.close(this.queue.added().length);
  }

  private onCodes(values: string[]): void {
    for (const isbn of this.readFilter.accept(values)) {
      // Not on iOS: the preview and the announcement are the feedback that always exists
      navigator.vibrate?.(80);
      this.queue.enqueue(isbn);
    }
  }

  private onCameraError(error: unknown): void {
    this.stopCamera();
    const kind = error instanceof ScannerError ? error.kind : 'camera-failed';
    this.cameraError.set(CAMERA_ERRORS[kind]);
  }

  private stopCamera(): void {
    this.cameraRequest++;
    this.session?.stop();
    this.session = null;
    this.torchAvailable.set(false);
    this.torchOn.set(false);
  }
}
