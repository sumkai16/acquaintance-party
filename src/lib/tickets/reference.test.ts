import { describe, expect, it } from "vitest";
import {
  findGcashReference,
  isValidGcashReference,
  normalizeGcashReference,
} from "./reference";

describe("findGcashReference", () => {
  it("reads the number off the Ref No. line of a GCash receipt", () => {
    const text = [
      "EM..N B.",
      "+63 993 004 9671",
      "Sent via GCash",
      "Total Amount Sent P495.00",
      "Ref No 5045014788131 Sep 13, 2026 9:58 PM",
    ].join("\n");
    expect(findGcashReference(text)).toBe("5045014788131");
  });

  it("ignores the twelve-digit phone number", () => {
    expect(findGcashReference("+63 993 004 9671\nSent via GCash")).toBeNull();
  });

  it("joins a reference shown in spaced groups", () => {
    expect(findGcashReference("Ref. No. 5045 014 788131")).toBe("5045014788131");
  });

  it("separates the reference from a date OCR ran into it", () => {
    expect(findGcashReference("Ref No 5045014788131 13 2026")).toBe("5045014788131");
  });

  it("finds a number whose label wrapped onto the line above", () => {
    expect(findGcashReference("Ref No.\n5045014788131")).toBe("5045014788131");
  });

  it("prefers the labelled number over an unlabelled one", () => {
    expect(findGcashReference("1111111111111\nRef No 5045014788131")).toBe(
      "5045014788131",
    );
  });

  it("takes a lone unlabelled thirteen-digit number", () => {
    expect(findGcashReference("5045014788131")).toBe("5045014788131");
  });

  it("gives up when several unlabelled numbers could be the reference", () => {
    expect(findGcashReference("1111111111111\n2222222222222")).toBeNull();
  });

  it("returns null for text with no reference", () => {
    expect(findGcashReference("By going digital, you reduce your carbon footprint")).toBeNull();
  });
});

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
