/**
 * Satori — what next/og rasterises an ImageResponse with — gives no way to
 * measure rendered text, so a certificate that must fit inside the artwork's
 * underline has to estimate. These tables are per-character advance widths in
 * em, which is crude but far better than one average: "WILLIAM" and "ILILILI"
 * are the same length and nowhere near the same width.
 *
 * Values are eyeballed from the two committed faces and deliberately err
 * wide. Overestimating shrinks a name slightly more than necessary;
 * underestimating lets it overhang the artwork, which is the failure this
 * whole module exists to prevent.
 */
export type WidthProfile = {
  /** Fallback advance for any character not in `widths`. */
  default: number;
  widths: Record<string, number>;
};

/** Anton: condensed, heavy, used uppercase for the recipient's name. */
export const ANTON: WidthProfile = {
  default: 0.5,
  widths: {
    " ": 0.24, "-": 0.3, ".": 0.24, ",": 0.24, "'": 0.18, "’": 0.18,
    I: 0.22, J: 0.4, L: 0.42, T: 0.44, F: 0.42, E: 0.44, P: 0.46,
    M: 0.72, W: 0.74, O: 0.56, Q: 0.56, G: 0.55, D: 0.54, N: 0.55,
    H: 0.55, U: 0.54, R: 0.5, B: 0.5, C: 0.5, S: 0.47, A: 0.52,
    V: 0.5, X: 0.5, Y: 0.48, Z: 0.46, K: 0.5,
  },
};

/**
 * Cormorant Bold: the signatory names, set uppercase to sit with the serif
 * roles printed in the artwork.
 *
 * Unlike ANTON above, these are not eyeballed — they are the font's own
 * advance widths, read straight out of assets/fonts/Cormorant-Bold.ttf and
 * divided by its 1000 unitsPerEm. Only the characters a name can contain are
 * listed; anything else falls back to `default`.
 */
export const CORMORANT: WidthProfile = {
  default: 0.7,
  widths: {
    " ": 0.234, "-": 0.323, ".": 0.207, "'": 0.15, A: 0.716, B: 0.595,
    C: 0.669, D: 0.705, E: 0.552, F: 0.522, G: 0.719, H: 0.764, I: 0.342,
    J: 0.339, K: 0.655, L: 0.545, M: 0.857, N: 0.735, O: 0.766, P: 0.553,
    Q: 0.766, R: 0.698, S: 0.515, T: 0.643, U: 0.703, V: 0.66, W: 0.911,
    X: 0.647, Y: 0.619, Z: 0.605,
  },
};

/**
 * Width of `text` at `fontSize`, estimated from the profile's advances.
 * `letterSpacing` is in px and counted between glyphs, matching how CSS
 * applies it — leaving it out of the estimate would let a tracked-out line
 * overflow by the whole accumulated gap.
 */
export function estimateWidth(
  text: string,
  fontSize: number,
  profile: WidthProfile,
  letterSpacing = 0,
): number {
  const chars = [...text];
  let ems = 0;
  for (const char of chars) {
    ems += profile.widths[char] ?? profile.default;
  }
  return ems * fontSize + Math.max(0, chars.length - 1) * letterSpacing;
}

/**
 * The largest whole font size at which `text` fits `maxWidth` on one line —
 * `max` when it already fits, never below `min`. Below `min` the caller has
 * to accept an overhang; that's why the recipient's name is capped at 60
 * characters on the way in (see registrations/schema.ts) rather than being
 * shrunk without limit into something nobody can read.
 */
export function fitFontSize(
  text: string,
  maxWidth: number,
  {
    max,
    min,
    profile,
    letterSpacing = 0,
  }: { max: number; min: number; profile: WidthProfile; letterSpacing?: number },
): number {
  for (let size = max; size > min; size -= 1) {
    if (estimateWidth(text, size, profile, letterSpacing) <= maxWidth) return size;
  }
  return min;
}
