import { describe, expect, it } from "vitest";
import { ANTON, CORMORANT, estimateWidth, fitFontSize } from "./fit-text";

const NAME_WIDTH = 1120;
const options = { max: 120, min: 44, profile: ANTON };

describe("fitFontSize", () => {
  it("leaves a short name at the full size", () => {
    expect(fitFontSize("JUAN DELA CRUZ", NAME_WIDTH, options)).toBe(120);
  });

  it("shrinks the name that prompted this, instead of wrapping it", () => {
    const size = fitFontSize("MARIA CRISTINA VILLANUEVA-SANTOS", NAME_WIDTH, options);
    expect(size).toBeLessThan(120);
    expect(size).toBeGreaterThan(44);
  });

  it("keeps a fitted name inside the width it was given", () => {
    const name = "MARIA CRISTINA VILLANUEVA-SANTOS";
    const size = fitFontSize(name, NAME_WIDTH, options);
    expect(estimateWidth(name, size, ANTON)).toBeLessThanOrEqual(NAME_WIDTH);
  });

  it("clamps at the floor rather than shrinking to nothing", () => {
    expect(fitFontSize("M".repeat(200), NAME_WIDTH, options)).toBe(44);
  });

  // The whole reason for a per-character table over one average: these two
  // are the same length and nothing like the same width.
  it("fits narrow letters larger than wide ones of the same count", () => {
    const narrow = fitFontSize("IIIIIIIIIIIIIIIIIIII", NAME_WIDTH, options);
    const wide = fitFontSize("MMMMMMMMMMMMMMMMMMMM", NAME_WIDTH, options);
    expect(narrow).toBeGreaterThan(wide);
  });

  it("returns the full size for an empty string rather than dividing by zero", () => {
    expect(fitFontSize("", NAME_WIDTH, options)).toBe(120);
  });

  // Signatory names render uppercase, in Cormorant, tracked out — so that is
  // exactly what the fit has to survive.
  it.each(["KENNETH CANON", "BRENDON BENITEZ", "AXCEE F. CABUSAS"])(
    "fits %s into its signature column",
    (name) => {
      const column = 396 - 20;
      const tracking = 2;
      const size = fitFontSize(name, column, {
        max: 38,
        min: 20,
        profile: CORMORANT,
        letterSpacing: tracking,
      });
      expect(estimateWidth(name, size, CORMORANT, tracking)).toBeLessThanOrEqual(column);
    },
  );

  it("counts tracking between glyphs, not after the last one", () => {
    const plain = estimateWidth("ABC", 10, CORMORANT);
    expect(estimateWidth("ABC", 10, CORMORANT, 4)).toBe(plain + 8);
  });

  it("returns a smaller size once tracking is added", () => {
    const options = { max: 38, min: 8, profile: CORMORANT };
    const tracked = fitFontSize("BRENDON BENITEZ", 376, { ...options, letterSpacing: 6 });
    expect(tracked).toBeLessThan(fitFontSize("BRENDON BENITEZ", 376, options));
  });
});
