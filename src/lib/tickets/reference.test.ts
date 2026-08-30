import { describe, expect, it } from "vitest";
import { isValidGcashReference, normalizeGcashReference } from "./reference";

describe("normalizeGcashReference", () => {
  it("strips the spacing students copy out of the GCash app", () => {
    expect(normalizeGcashReference("1234 5678 90123")).toBe("1234567890123");
  });

  it("strips dashes and surrounding whitespace", () => {
    expect(normalizeGcashReference("  1234-5678-90123 ")).toBe("1234567890123");
  });

  it("leaves an already-clean reference untouched", () => {
    expect(normalizeGcashReference("1234567890123")).toBe("1234567890123");
  });

  it("drops non-digits rather than throwing, so validation can report", () => {
    expect(normalizeGcashReference("Ref: 1234567890123")).toBe("1234567890123");
  });
});

describe("isValidGcashReference", () => {
  it("accepts exactly thirteen digits", () => {
    expect(isValidGcashReference("1234567890123")).toBe(true);
  });

  it("accepts thirteen digits with the app's spacing", () => {
    expect(isValidGcashReference("1234 5678 90123")).toBe(true);
  });

  it("rejects twelve digits", () => {
    expect(isValidGcashReference("123456789012")).toBe(false);
  });

  it("rejects fourteen digits", () => {
    expect(isValidGcashReference("12345678901234")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidGcashReference("")).toBe(false);
  });

  it("rejects letters", () => {
    expect(isValidGcashReference("abcdefghijklm")).toBe(false);
  });
});
