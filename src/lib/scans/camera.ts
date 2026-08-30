/**
 * Starts decoding QR codes from a live camera stream and returns a stop
 * function.
 *
 * Native `BarcodeDetector` where it exists (Android Chrome) — it is faster and
 * costs no bundle weight. `@zxing/browser` everywhere else, which in practice
 * means every iPhone, since Safari has never shipped BarcodeDetector.
 */
export async function startDecoder(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
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

    const tick = async () => {
      if (!running) return;
      try {
        const [first] = await detector.detect(video);
        if (first?.rawValue) onCode(first.rawValue);
      } catch {
        // A dropped frame is not an error worth surfacing; the next one lands
        // ~100ms later. Anything fatal shows up as the stream ending instead.
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
  const controls = await new BrowserQRCodeReader().decodeFromVideoElement(
    video,
    (result) => {
      if (result) onCode(result.getText());
    },
  );

  return () => {
    controls.stop();
    stopStream();
  };
}
