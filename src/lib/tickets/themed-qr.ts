import QRCode from "qrcode";
import { THEME } from "@/lib/config/theme";

/**
 * A QR in the party's own colours — "Sunset Fade", chosen 2026-09-20 from ten
 * mockups: rounded modules on sand that shade from dusk plum at the top to
 * deep clay at the bottom, with rounded finder "eyes".
 *
 * For the faculty invitation only. The TICKET QR stays pure black on pure
 * white (see qr.ts and context/DESIGN.md §4) — that one is read at the door,
 * in the dark, by a volunteer under time pressure. This one is printed on a
 * letter and scanned at leisure, so it can afford some style, but it is still
 * a QR and the style is held to what a phone camera tolerates:
 *
 * - Contrast stays high along the WHOLE gradient. A scanner only cares about
 *   dark-versus-light luminance, so the palette is free while the contrast is
 *   not: plum starts at roughly 10:1 against sand and the deep clay it ends on
 *   is still well clear of it. The end stop is deliberately darker than the
 *   brand's own clay (#C2481F, about 3.3:1) for exactly that reason. Never
 *   fade toward gold or sage — they read as mid-tones and lose scans.
 * - Dark on light only. An inverted code (light modules on a dark ground)
 *   fails on many scanners.
 * - A four-module quiet zone, unchanged.
 * - Error correction H (30%) rather than the ticket's M, because rounded
 *   modules carry a little less ink than square ones and the extra headroom
 *   pays for that.
 *
 * Emitted as an SVG so it stays sharp at any print size. It is delivered as a
 * data URL for an <img>, which — like qr.ts — means no raw HTML is injected
 * anywhere.
 */
const QUIET_ZONE = 4;

/**
 * The fade's three stops, top to bottom. Plum is the theme's own `deep`. The
 * other two are not theme tokens: they are the darkest shades that still read
 * as wine and clay while keeping every module a firm dark against the sand.
 */
const FADE = {
  top: THEME.colors.deep,
  mid: "#6E2438",
  bottom: "#9C3A1B",
} as const;

/** Gradient id. One per document is enough: a page shows a single themed QR. */
const FADE_ID = "qr-fade";
const FINDER = 7;

/** Radius as a fraction of one module; 0 is a square, 0.5 a circle. */
const MODULE_RADIUS = 0.32;

type Matrix = { size: number; get: (row: number, col: number) => number };

function inFinder(row: number, col: number, size: number): boolean {
  const top = row < FINDER;
  const bottom = row >= size - FINDER;
  const left = col < FINDER;
  const right = col >= size - FINDER;
  return (top && left) || (top && right) || (bottom && left);
}

/**
 * One finder pattern: a 7×7 ring, a 3×3 core, and the light gap between them
 * left as background. Drawn as two shapes instead of 33 modules so the eyes
 * read as solid rounded squares, which is what makes the code look designed
 * rather than merely recoloured.
 */
function finder(x: number, y: number, dark: string): string {
  return (
    `<path fill="${dark}" fill-rule="evenodd" d="` +
    roundedRect(x, y, 7, 7, 2) +
    roundedRect(x + 1, y + 1, 5, 5, 1.2) +
    `"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9" fill="${dark}"/>`
  );
}

/** A rounded rectangle as path data, so two can share one evenodd path. */
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}` +
    `a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}` +
    `v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`
  );
}

/** The QR as an SVG string. Pure — no I/O — so it is unit-testable. */
export function themedQrSvg(
  value: string,
  palette: { fade: { top: string; mid: string; bottom: string }; light: string } = {
    fade: FADE,
    light: THEME.colors.ground,
  },
): string {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "H" });
  const matrix = modules as unknown as Matrix;
  const { size } = matrix;
  const total = size + QUIET_ZONE * 2;
  const ink = `url(#${FADE_ID})`;

  const dots: string[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!matrix.get(row, col) || inFinder(row, col, size)) continue;
      dots.push(
        `<rect x="${col + QUIET_ZONE}" y="${row + QUIET_ZONE}" width="1" height="1" ` +
          `rx="${MODULE_RADIUS}"/>`,
      );
    }
  }

  // userSpaceOnUse and spanning the code itself (not the quiet zone), so the
  // fade runs across the modules rather than being spent on empty margin —
  // and so every shape, the eyes included, samples one shared gradient
  // instead of each starting its own.
  const gradient =
    `<defs><linearGradient id="${FADE_ID}" gradientUnits="userSpaceOnUse" ` +
    `x1="0" y1="${QUIET_ZONE}" x2="0" y2="${QUIET_ZONE + size}">` +
    `<stop offset="0" stop-color="${palette.fade.top}"/>` +
    `<stop offset="0.55" stop-color="${palette.fade.mid}"/>` +
    `<stop offset="1" stop-color="${palette.fade.bottom}"/>` +
    `</linearGradient></defs>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `width="${total * 16}" height="${total * 16}" shape-rendering="geometricPrecision">` +
    gradient +
    `<rect width="${total}" height="${total}" fill="${palette.light}"/>` +
    `<g fill="${ink}">${dots.join("")}</g>` +
    finder(QUIET_ZONE, QUIET_ZONE, ink) +
    finder(QUIET_ZONE + size - FINDER, QUIET_ZONE, ink) +
    finder(QUIET_ZONE, QUIET_ZONE + size - FINDER, ink) +
    `</svg>`
  );
}

/** The themed QR as an SVG data URL, for an <img> tag or a download link. */
export function themedQrDataUrl(value: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(themedQrSvg(value)).toString("base64")}`;
}
