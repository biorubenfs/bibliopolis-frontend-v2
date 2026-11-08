import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import {
  BarcodeScannerService,
  ScannerError,
  ScannerErrorKind,
  ScannerSession,
} from '../../../books/barcode-scanner.service';
import { IsbnReadFilter } from '../../../books/isbn-barcode';

/** Full screen on a phone, like the scanner of the libraries. */
export const ISBN_SCAN_DIALOG_SIZE = {
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
 * Reads one ISBN with the camera and closes with it as an ISBN-13, or with nothing. Only one: each
 * book of the catalog may need to be added by hand, unlike when filling a library.
 */
@Component({
  selector: 'app-isbn-scan-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './isbn-scan-dialog.html',
  styleUrl: './isbn-scan-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IsbnScanDialog {
  private readonly scanner = inject(BarcodeScannerService);
  private readonly dialogRef = inject<MatDialogRef<IsbnScanDialog, string>>(MatDialogRef);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly cameraError = signal<string | null>(null);

  private readonly readFilter = new IsbnReadFilter();
  private session: ScannerSession | null = null;
  /** Changes when the camera is requested or released, to spot a start nobody is waiting for. */
  private cameraRequest = 0;

  constructor() {
    // The video element has to exist before the camera can be attached to it
    afterNextRender(() => this.startCamera());
    inject(DestroyRef).onDestroy(() => this.stopCamera());
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
    } catch (error) {
      if (request === this.cameraRequest) {
        this.onCameraError(error);
      }
    }
  }

  private onCodes(values: string[]): void {
    const [isbn] = this.readFilter.accept(values);
    if (isbn) {
      navigator.vibrate?.(80);
      this.stopCamera();
      this.dialogRef.close(isbn);
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
  }
}
