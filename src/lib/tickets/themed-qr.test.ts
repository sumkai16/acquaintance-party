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
    const svg = themedQrSvg(URL_UNDER_TEST, {
      fade: { top: "#3b2136", mid: "#6e2438", bottom: "#9c3a1b" },
      light: "#f2e3cb",
    });
    const hex = new Set([...svg.matchAll(/(?:fill|stop-color)="(#[0-9a-f]{6})"/gi)].map((m) => m[1]));

    expect(hex).toEqual(new Set(["#3b2136", "#6e2438", "#9c3a1b", "#f2e3cb"]));
  });

  it("paints every module and eye from the one shared gradient", () => {
    const svg = themedQrSvg(URL_UNDER_TEST);

    expect(svg.match(/<linearGradient /g)).toHaveLength(1);
    // Nothing is filled with a flat dark: the eyes sample the gradient too.
    expect(svg.match(/fill="url\(#qr-fade\)"/g)!.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps the darkest-to-lightest ink well clear of the sand", async () => {
    // The gradient's END is where a scan would fail first. Force the fade to
    // its lightest stop everywhere and confirm it still decodes.
    const flatBottom = themedQrSvg(URL_UNDER_TEST, {
      fade: { top: "#9c3a1b", mid: "#9c3a1b", bottom: "#9c3a1b" },
      light: "#f2e3cb",
    });
    expect(await decode(flatBottom, 180)).toBe(URL_UNDER_TEST);
  });
});
