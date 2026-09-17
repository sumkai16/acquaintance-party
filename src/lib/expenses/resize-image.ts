const MAX_SIDE = 2400;
const JPEG_QUALITY = 0.82;

/**
 * Shrinks a phone photo in the browser before upload: longest side capped
 * at 2400px, re-encoded as JPEG. That's enough resolution for small receipt
 * print to stay legible when zoomed in the viewer, while a 3–8 MB camera
 * photo still lands around 400–900 KB — fast on event Wi-Fi and far under
 * the server action body limit. If the browser can't decode the image, the
 * original file is returned and the server's own size/type check decides.
 */
export async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "receipt";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
