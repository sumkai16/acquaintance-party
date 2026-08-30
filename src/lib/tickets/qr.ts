import QRCode from "qrcode";

/**
 * Renders a ticket code as a PNG data URL for an <img> tag.
 *
 * Pure black on pure white with a four-module quiet zone is not a style
 * choice — phone cameras fail on codes drawn over tinted or textured grounds,
 * and the door is the worst possible place to discover that.
 *
 * Error-correction level M tolerates a scuffed or dimmed phone screen without
 * inflating the module count the way H would.
 *
 * A data URL rather than inline SVG: it needs no raw HTML injection, so there
 * is nothing to sanitize anywhere in this project.
 */
export async function ticketQrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 512,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}
