import QRCode from "qrcode";

/**
 * Pure black on pure white with a four-module quiet zone is not a style
 * choice — phone cameras fail on codes drawn over tinted or textured grounds,
 * and the door is the worst possible place to discover that.
 *
 * Error-correction level M tolerates a scuffed or dimmed phone screen without
 * inflating the module count the way H would.
 *
 * One shared options object, not a copy per renderer: the ticket page and the
 * emailed PNG must produce the same code, and a drift between them would only
 * show up at the door.
 */
const QR_OPTIONS = {
  errorCorrectionLevel: "M",
  margin: 4,
  width: 512,
  color: { dark: "#000000", light: "#FFFFFF" },
} as const;

/**
 * Renders a ticket code as a PNG data URL for an <img> tag.
 *
 * A data URL rather than inline SVG: it needs no raw HTML injection, so there
 * is nothing to sanitize anywhere in this project.
 */
export async function qrDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, QR_OPTIONS);
}

/**
 * The same code as raw PNG bytes, for the hosted image route the emailed
 * ticket points at — a data URL can't be an email's <img src>, and Resend's
 * batch endpoint refuses attachments.
 */
export async function qrPngBuffer(value: string): Promise<Buffer> {
  return QRCode.toBuffer(value, { ...QR_OPTIONS, type: "png" });
}

export async function ticketQrDataUrl(code: string): Promise<string> {
  return qrDataUrl(code);
}
