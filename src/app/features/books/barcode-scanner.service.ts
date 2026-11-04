import { Injectable } from '@angular/core';

export type ScannerErrorKind =
  'unsupported' | 'permission-denied' | 'no-camera' | 'camera-failed' | 'engine-failed';

export class ScannerError extends Error {
  constructor(readonly kind: ScannerErrorKind) {
    super(`Barcode scanner error: ${kind}`);
    this.name = 'ScannerError';
  }
}

export interface ScannerCallbacks {
  /** Receives the values read in one video frame. Only called when a detection has finished. */
  onCodes(values: string[]): void;
  /** A problem after the scanner had started, such as not getting the camera back. */
  onError(error: ScannerError): void;
}

export interface ScannerSession {
  /** Which engine reads the codes: useful when comparing them on real devices. */
  readonly engine: 'native' | 'wasm';
  readonly torchAvailable: boolean;
  setTorch(on: boolean): Promise<void>;
  /** Turns the camera off. A stopped session cannot be started again. */
  stop(): void;
}

/** The part of the Barcode Detection API shared by the native detector and the ponyfill. */
interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

interface NativeDetectorConstructor {
  new (): Detector;
  getSupportedFormats(): Promise<string[]>;
}

/** Camera features missing from TypeScript's DOM types because not every browser has them. */
interface CameraCapabilities extends MediaTrackCapabilities {
  focusMode?: string[];
  torch?: boolean;
}

interface CameraConstraintSet extends MediaTrackConstraintSet {
  focusMode?: string;
  torch?: boolean;
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

/** About 10 attempts per second. Adjust after measuring on real phones. */
const MIN_MS_BETWEEN_DETECTIONS = 100;
/** About 3 seconds failing in a row: a real problem, not a video that is not ready yet. */
const MAX_CONSECUTIVE_FAILURES = 30;

/**
 * Opens the camera and reads barcodes from it. It only turns the camera into raw values: deciding
 * which of them are ISBNs is the job of `IsbnReadFilter`.
 */
@Injectable({ providedIn: 'root' })
export class BarcodeScannerService {
  /** Fails with a `ScannerError`. The caller must call `stop()` on the session it gets. */
  async start(video: HTMLVideoElement, callbacks: ScannerCallbacks): Promise<ScannerSession> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new ScannerError('unsupported');
    }

    const { detector, engine } = await this.createDetector();
    const session = new CameraSession(video, detector, engine, callbacks);
    await session.open();
    return session;
  }

  /** Loaded on demand so the library stays out of the initial bundle. */
  protected loadPonyfill() {
    return import('barcode-detector/ponyfill');
  }

  private async createDetector(): Promise<{ detector: Detector; engine: 'native' | 'wasm' }> {
    const native = await this.findNativeDetector();
    if (native) {
      return { detector: new native(), engine: 'native' };
    }

    try {
      const { BarcodeDetector, prepareZXingModule } = await this.loadPonyfill();
      // Served by us instead of the default CDN (see "assets" in angular.json). Waiting for it here
      // reports a failed download before the camera opens, and not as a failure on every frame.
      await prepareZXingModule({
        overrides: {
          locateFile: (path: string, prefix: string) =>
            path.endsWith('.wasm') ? new URL(`wasm/${path}`, document.baseURI).href : prefix + path,
        },
        fireImmediately: true,
      });
      // No `formats`: read them all. Whether a value is an ISBN does not depend on its format
      return { detector: new BarcodeDetector(), engine: 'wasm' };
    } catch {
      throw new ScannerError('engine-failed');
    }
  }

  /** The browser's detector, only if it reads EAN-13: the format almost every book uses. */
  private async findNativeDetector(): Promise<NativeDetectorConstructor | null> {
    const native = (globalThis as { BarcodeDetector?: NativeDetectorConstructor }).BarcodeDetector;
    try {
      return native && (await native.getSupportedFormats()).includes('ean_13') ? native : null;
    } catch {
      return null;
    }
  }
}

class CameraSession implements ScannerSession {
  torchAvailable = false;

  private stream: MediaStream | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private torchOn = false;
  private stopped = false;
  /** Changes each time the camera opens or closes, which invalidates anything still in progress. */
  private run = 0;
  private detecting = false;
  private lastDetection = Number.NEGATIVE_INFINITY;
  private failures = 0;

  private readonly onVisibilityChange = () => {
    if (document.hidden) {
      this.closeCamera();
    } else if (!this.stopped) {
      this.openCamera().catch((error: unknown) => this.callbacks.onError(toScannerError(error)));
    }
  };

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly detector: Detector,
    readonly engine: 'native' | 'wasm',
    private readonly callbacks: ScannerCallbacks,
  ) {}

  async open(): Promise<void> {
    try {
      await this.openCamera();
    } catch (error) {
      this.stop();
      throw toScannerError(error);
    }
    // Never keep the camera on while the page is not visible
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  async setTorch(on: boolean): Promise<void> {
    this.torchOn = on;
    await this.applyCameraSettings({ torch: on });
  }

  stop(): void {
    this.stopped = true;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.closeCamera();
    this.video.srcObject = null;
  }

  private async openCamera(): Promise<void> {
    const run = ++this.run;
    const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
    if (run !== this.run) {
      stopTracks(stream);
      return;
    }

    this.stream = stream;
    // Set here as well as in the template: iOS does not play inline video without them
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = stream;
    try {
      await this.video.play();
    } catch (error) {
      // Closing the camera while it starts also interrupts play(), which is not an error
      if (run === this.run) {
        throw error;
      }
      return;
    }

    await this.configureCamera();
    await this.keepScreenOn(run);
    this.scheduleFrame(run);
  }

  private closeCamera(): void {
    this.run++;
    if (this.stream) {
      stopTracks(this.stream);
      this.stream = null;
    }
    this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }

  private async configureCamera(): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    const capabilities = track?.getCapabilities?.() as CameraCapabilities | undefined;
    this.torchAvailable = capabilities?.torch === true;

    if (capabilities?.focusMode?.includes('continuous')) {
      await this.applyCameraSettings({ focusMode: 'continuous' });
    }
    // Coming back to the page reopens the camera, which turns the torch off
    if (this.torchOn) {
      await this.applyCameraSettings({ torch: true });
    }
  }

  /** Not every device honours these settings, and the camera still works without them. */
  private async applyCameraSettings(settings: CameraConstraintSet): Promise<void> {
    try {
      await this.stream?.getVideoTracks()[0]?.applyConstraints({ advanced: [settings] });
    } catch {
      // Nothing to do: see above
    }
  }

  private async keepScreenOn(run: number): Promise<void> {
    if (!('wakeLock' in navigator)) {
      return;
    }
    try {
      const wakeLock = await navigator.wakeLock.request('screen');
      if (run === this.run) {
        this.wakeLock = wakeLock;
      } else {
        await wakeLock.release();
      }
    } catch {
      // The browser may refuse it, for instance with low battery. The scanner still works
    }
  }

  private scheduleFrame(run: number): void {
    const onFrame = () => this.onFrame(run);
    if ('requestVideoFrameCallback' in this.video) {
      this.video.requestVideoFrameCallback(onFrame);
    } else {
      requestAnimationFrame(onFrame);
    }
  }

  private onFrame(run: number): void {
    if (run !== this.run) {
      return;
    }

    // Only one detection at a time: a slow phone skips frames instead of piling up work
    const now = performance.now();
    if (!this.detecting && now - this.lastDetection >= MIN_MS_BETWEEN_DETECTIONS) {
      this.lastDetection = now;
      this.detect(run);
    }
    this.scheduleFrame(run);
  }

  private detect(run: number): void {
    this.detecting = true;
    this.detector
      .detect(this.video)
      .then(
        (codes) => {
          this.failures = 0;
          if (run === this.run) {
            this.callbacks.onCodes(codes.map((code) => code.rawValue));
          }
        },
        () => {
          this.failures++;
          if (run === this.run && this.failures === MAX_CONSECUTIVE_FAILURES) {
            this.callbacks.onError(new ScannerError('engine-failed'));
          }
        },
      )
      .finally(() => {
        this.detecting = false;
      });
  }
}

function stopTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

function toScannerError(error: unknown): ScannerError {
  if (error instanceof ScannerError) {
    return error;
  }
  switch ((error as { name?: unknown } | null)?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new ScannerError('permission-denied');
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new ScannerError('no-camera');
    default:
      return new ScannerError('camera-failed');
  }
}
