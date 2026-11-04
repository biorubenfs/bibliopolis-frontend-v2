import { Mock } from 'vitest';

import {
  BarcodeScannerService,
  ScannerCallbacks,
  ScannerError,
  ScannerSession,
} from './barcode-scanner.service';

type FakeDetect = ReturnType<typeof vi.fn>;

/** `getUserMedia` does not exist in jsdom: these tests check our logic around a fake camera. */
describe('BarcodeScannerService', () => {
  let frames: FrameRequestCallback[];
  let sessions: ScannerSession[];
  let tracks: { stop: ReturnType<typeof vi.fn> }[];
  let getUserMedia: ReturnType<typeof vi.fn>;
  let video: HTMLVideoElement;
  let callbacks: {
    onCodes: Mock<ScannerCallbacks['onCodes']>;
    onError: Mock<ScannerCallbacks['onError']>;
  };

  function fakeStream(capabilities: object = {}) {
    const track = {
      stop: vi.fn(),
      getCapabilities: () => capabilities,
      applyConstraints: vi.fn(() => Promise.resolve()),
    };
    tracks.push(track);
    return { getTracks: () => [track], getVideoTracks: () => [track], track };
  }

  function nativeDetector(detect: FakeDetect, formats = ['ean_13']) {
    const detector = vi.fn(function () {
      return { detect };
    });
    vi.stubGlobal(
      'BarcodeDetector',
      Object.assign(detector, { getSupportedFormats: () => Promise.resolve(formats) }),
    );
    return detector;
  }

  /** Started through here so that no session outlives its test, listening to the document. */
  async function start(service: BarcodeScannerService) {
    const session = await service.start(video, callbacks);
    sessions.push(session);
    return session;
  }

  /** Runs the pending video frame and lets its detection finish. */
  async function runFrame() {
    frames.shift()?.(0);
    await vi.waitFor(() => Promise.resolve());
    await Promise.resolve();
  }

  beforeEach(() => {
    frames = [];
    sessions = [];
    tracks = [];
    getUserMedia = vi.fn(() => Promise.resolve(fakeStream()));
    vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame));
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    video = document.createElement('video');
    vi.spyOn(video, 'play').mockResolvedValue();
    Object.defineProperty(video, 'srcObject', { writable: true, value: null });
    callbacks = { onCodes: vi.fn(), onError: vi.fn() };
    // Each frame is far enough from the previous one for a new detection
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (now += 1000));
  });

  afterEach(() => {
    sessions.forEach((session) => session.stop());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  describe('engine', () => {
    class ServiceWithFakePonyfill extends BarcodeScannerService {
      readonly prepareZXingModule = vi.fn((_options: unknown) => Promise.resolve());
      readonly detector = vi.fn(function () {
        return { detect: () => Promise.resolve([]) };
      });
      protected override loadPonyfill() {
        return Promise.resolve({
          BarcodeDetector: this.detector,
          prepareZXingModule: this.prepareZXingModule,
        }) as unknown as ReturnType<BarcodeScannerService['loadPonyfill']>;
      }
    }

    it('uses the native detector when it reads EAN-13, without limiting the formats', async () => {
      const detector = nativeDetector(vi.fn(() => Promise.resolve([])));
      const service = new ServiceWithFakePonyfill();

      const session = await start(service);

      expect(session.engine).toBe('native');
      expect(detector).toHaveBeenCalledWith();
      expect(service.prepareZXingModule).not.toHaveBeenCalled();
    });

    it('uses WebAssembly when the native detector does not read EAN-13', async () => {
      nativeDetector(
        vi.fn(() => Promise.resolve([])),
        ['qr_code'],
      );

      const session = await start(new ServiceWithFakePonyfill());

      expect(session.engine).toBe('wasm');
    });

    it('serves the WebAssembly file from our own server', async () => {
      const service = new ServiceWithFakePonyfill();

      const session = await start(service);

      expect(session.engine).toBe('wasm');
      expect(service.detector).toHaveBeenCalledWith();
      const options = service.prepareZXingModule.mock.calls[0][0] as {
        overrides: { locateFile(path: string, prefix: string): string };
      };
      expect(options.overrides.locateFile('zxing_reader.wasm', 'https://cdn/')).toBe(
        new URL('wasm/zxing_reader.wasm', document.baseURI).href,
      );
    });

    it('reports an engine that cannot be loaded, without opening the camera', async () => {
      const service = new ServiceWithFakePonyfill();
      service.prepareZXingModule.mockRejectedValue(new Error('offline'));

      await expect(service.start(video, callbacks)).rejects.toMatchObject({
        kind: 'engine-failed',
      });
      expect(getUserMedia).not.toHaveBeenCalled();
    });
  });

  describe('camera', () => {
    let detect: FakeDetect;
    const service = new BarcodeScannerService();

    beforeEach(() => {
      detect = vi.fn(() => Promise.resolve([{ rawValue: '9780595385294' }]));
      nativeDetector(detect);
    });

    it('asks for the rear camera at high resolution', async () => {
      await start(service);

      expect(getUserMedia).toHaveBeenCalledWith({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
    });

    it.each([
      ['NotAllowedError', 'permission-denied'],
      ['NotFoundError', 'no-camera'],
      ['NotReadableError', 'camera-failed'],
    ])('translates %s into %s', async (name, kind) => {
      getUserMedia.mockRejectedValue(new DOMException('error', name));

      await expect(service.start(video, callbacks)).rejects.toEqual(
        expect.objectContaining<Partial<ScannerError>>({ kind: kind as ScannerError['kind'] }),
      );
    });

    it('reports a browser without camera access', async () => {
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });

      await expect(service.start(video, callbacks)).rejects.toMatchObject({ kind: 'unsupported' });
    });

    it('turns the camera off if the video cannot play', async () => {
      vi.mocked(video.play).mockRejectedValue(new DOMException('error', 'NotAllowedError'));

      await expect(service.start(video, callbacks)).rejects.toMatchObject({
        kind: 'permission-denied',
      });
      expect(tracks[0].stop).toHaveBeenCalled();
    });

    it('sends what it reads', async () => {
      await start(service);

      await runFrame();

      expect(callbacks.onCodes).toHaveBeenCalledWith(['9780595385294']);
    });

    it('never runs two detections at once', async () => {
      let finish: (codes: { rawValue: string }[]) => void = () => undefined;
      detect.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
      await start(service);

      await runFrame();
      await runFrame();
      expect(detect).toHaveBeenCalledTimes(1);

      finish([]);
      await runFrame();
      await runFrame();
      expect(detect).toHaveBeenCalledTimes(2);
    });

    it('limits the detections per second', async () => {
      await start(service);
      vi.mocked(performance.now).mockReturnValue(5000);

      await runFrame();
      await runFrame();

      expect(detect).toHaveBeenCalledTimes(1);
    });

    it('reports a detector that keeps failing, once', async () => {
      detect.mockRejectedValue(new Error('broken'));
      await start(service);

      for (let i = 0; i < 31; i++) {
        await runFrame();
      }

      expect(callbacks.onError).toHaveBeenCalledTimes(1);
      expect(callbacks.onError.mock.calls[0][0]).toMatchObject({ kind: 'engine-failed' });
    });

    it('turns the camera off when stopped, and stops reading', async () => {
      const session = await start(service);

      session.stop();
      await runFrame();

      expect(tracks[0].stop).toHaveBeenCalled();
      expect(video.srcObject).toBeNull();
      expect(detect).not.toHaveBeenCalled();
      expect(frames).toEqual([]);
    });

    it('ignores a detection that finishes after stopping', async () => {
      let finish: (codes: { rawValue: string }[]) => void = () => undefined;
      detect.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
      const session = await start(service);
      await runFrame();

      session.stop();
      finish([{ rawValue: '9780595385294' }]);
      await runFrame();

      expect(callbacks.onCodes).not.toHaveBeenCalled();
    });

    describe('when the page is hidden', () => {
      function setHidden(hidden: boolean) {
        Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
        document.dispatchEvent(new Event('visibilitychange'));
      }

      afterEach(() => {
        Reflect.deleteProperty(document, 'hidden');
      });

      it('turns the camera off and opens it again on return', async () => {
        const session = await start(service);

        setHidden(true);
        expect(tracks[0].stop).toHaveBeenCalled();

        setHidden(false);
        await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
        session.stop();
      });

      it('reports not getting the camera back', async () => {
        const session = await start(service);
        getUserMedia.mockRejectedValue(new DOMException('error', 'NotReadableError'));

        setHidden(true);
        setHidden(false);

        await vi.waitFor(() => expect(callbacks.onError).toHaveBeenCalledTimes(1));
        session.stop();
      });

      it('does not open the camera after stopping', async () => {
        const session = await start(service);
        session.stop();

        setHidden(true);
        setHidden(false);

        expect(getUserMedia).toHaveBeenCalledTimes(1);
      });
    });

    describe('torch', () => {
      it('is only offered if the camera has one', async () => {
        const session = await start(service);
        expect(session.torchAvailable).toBe(false);
        session.stop();

        const stream = fakeStream({ torch: true });
        getUserMedia.mockResolvedValue(stream);
        const withTorch = await start(service);

        expect(withTorch.torchAvailable).toBe(true);
        await withTorch.setTorch(true);
        expect(stream.track.applyConstraints).toHaveBeenCalledWith({
          advanced: [{ torch: true }],
        });
        withTorch.stop();
      });

      it('does not fail on a device that refuses it', async () => {
        const stream = fakeStream({ torch: true });
        stream.track.applyConstraints.mockRejectedValue(new Error('refused'));
        getUserMedia.mockResolvedValue(stream);
        const session = await start(service);

        await expect(session.setTorch(true)).resolves.toBeUndefined();
        session.stop();
      });
    });

    it('asks for continuous focus where it exists', async () => {
      const stream = fakeStream({ focusMode: ['manual', 'continuous'] });
      getUserMedia.mockResolvedValue(stream);

      const session = await start(service);

      expect(stream.track.applyConstraints).toHaveBeenCalledWith({
        advanced: [{ focusMode: 'continuous' }],
      });
      session.stop();
    });
  });
});
