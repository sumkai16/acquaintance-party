import { findGcashReference } from "@/lib/tickets/reference";

/**
 * Tested against real receipts: a clean GCash screenshot reads exactly at
 * this size, and a blurry photo of a screen doesn't read at any size — so
 * there's no gain from sending Tesseract a 12 MP phone photo, only a slower
 * read on the student's phone.
 */
const MAX_SIDE = 1600;

/**
 * Reads the GCash reference number off a receipt image, in the browser, or
 * null when it can't find one. Tesseract (the wasm engine and its English
 * data, ~5 MB) is only downloaded here, once a student picks a file — never
 * on page load.
 */
export async function readReferenceFromImage(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(canvas);
    return findGcashReference(data.text);
  } finally {
    // One read per file pick; don't leave a worker holding memory on a phone.
    await worker.terminate();
  }
}
