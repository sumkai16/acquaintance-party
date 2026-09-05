import "server-only";
import { PDFDocument } from "pdf-lib";

/** A4 landscape in PDF points — the same ratio the PNG is rendered at. */
const PAGE = { width: 841.89, height: 595.28 };

/**
 * Wraps the rendered certificate in a one-page PDF.
 *
 * The PNG already carries the type, so nothing here embeds a font or measures
 * a string — the page is one full-bleed image, which is also why this needs
 * pdf-lib alone and not @pdf-lib/fontkit.
 */
export async function certificatePdf(
  png: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const image = await doc.embedPng(png);

  page.drawImage(image, {
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
  });

  // Re-wrapped so the bytes are typed against a plain ArrayBuffer, which is
  // what a Response body accepts.
  return new Uint8Array(await doc.save());
}
