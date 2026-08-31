export type DecoderDiagnostics = {
  engine: "barcode-detector" | "zxing";
  framesTried: number;
  lastError: string | null;
};

/**
 * Starts decoding QR codes from a live camera stream and returns a stop
 * function.
 *
 * Native `BarcodeDetector` where it exists (Android Chrome) — it is faster and
 * costs no bundle weight. `@zxing/browser` everywhere else, which in practice
 * means every iPhone, since Safari has never shipped BarcodeDetector.
 *
 * `onDiag` is optional and exists to answer "is the camera loop even running"
 * from a screenshot during field testing, without needing device access.
 */
export async function startDecoder(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
  onDiag?: (diag: DecoderDiagnostics) => void,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    // The back camera. Without this a laptop or a front-facing phone opens the
    // selfie camera and the volunteer cannot see what they are aiming at.
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });

  video.srcObject = stream;
  video.setAttribute("playsinline", "true"); // iOS otherwise goes fullscreen
  await video.play();

  const stopStream = () => stream.getTracks().forEach((track) => track.stop());

  const Detector = (
    globalThis as unknown as {
      BarcodeDetector?: new (o: object) => {
        detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]>;
      };
    }
  ).BarcodeDetector;

  if (Detector) {
    const detector = new Detector({ formats: ["qr_code"] });
    let running = true;
    let framesTried = 0;

    const tick = async () => {
      if (!running) return;
      try {
        const [first] = await detector.detect(video);
        framesTried++;
        onDiag?.({ engine: "barcode-detector", framesTried, lastError: null });
        if (first?.rawValue) onCode(first.rawValue);
      } catch (err) {
        framesTried++;
        onDiag?.({
          engine: "barcode-detector",
          framesTried,
          lastError: err instanceof Error ? err.message : String(err),
        });
      }
      if (running) setTimeout(tick, 100);
    };
    void tick();

    return () => {
      running = false;
      stopStream();
    };
  }

  const { BrowserQRCodeReader } = await import("@zxing/browser");
  let framesTried = 0;
  const controls = await new BrowserQRCodeReader().decodeFromVideoElement(
    video,
    (result, err) => {
      framesTried++;
      onDiag?.({
        engine: "zxing",
        framesTried,
        lastError: result ? null : (err?.message ?? null),
      });
      if (result) onCode(result.getText());
    },
  );

  return () => {
    controls.stop();
    stopStream();
  };
}
