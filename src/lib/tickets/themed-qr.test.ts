import sharp from "sharp";
import {
  BinaryBitmap,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} from "@zxing/library";
import { describe, expect, it } from "vitest";
import { themedQrSvg } from "./themed-qr";

/**
 * Rasterise the SVG and read it back with a real QR decoder. A styled QR that
 * merely looks right is exactly the failure this exists to catch: rounded
 * modules and recoloured ink can look perfect and still not scan.
 */
async function decode(svg: string, width = 720): Promise<string> {
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(width, width)
    .flatten({ background: "#ffffff" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const luminance = new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
  return new QRCodeReader().decode(bitmap).getText();
}

const URL_UNDER_TEST = "https://itech2026.site/invitation";

describe("themedQrSvg", () => {
  it("scans back to the exact URL in the theme colours", async () => {
    expect(await decode(themedQrSvg(URL_UNDER_TEST))).toBe(URL_UNDER_TEST);
  });

  it("still scans when printed small", async () => {
    // ~4cm on a letter is well under 200px on screen.
    expect(await decode(themedQrSvg(URL_UNDER_TEST), 180)).toBe(URL_UNDER_TEST);
  });

  it("scans a long URL, which needs a denser code", async () => {
    const long = `${URL_UNDER_TEST}?source=printed-letter&batch=faculty-2026&ref=adviser-copy`;
    expect(await decode(themedQrSvg(long))).toBe(long);
  });

  it("uses the palette it was given and nothing else", () => {
    const svg = themedQrSvg(URL_UNDER_TEST, { dark: "#3b2136", light: "#f2e3cb" });
    const fills = new Set([...svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map((m) => m[1]));

    expect(fills).toEqual(new Set(["#3b2136", "#f2e3cb"]));
  });
});
