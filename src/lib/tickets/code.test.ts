import { describe, expect, it } from "vitest";
import {
  TICKET_CODE_ALPHABET,
  TICKET_CODE_LENGTH,
  formatTicketCode,
  generateTicketCode,
  normalizeScannedCode,
} from "./code";

describe("generateTicketCode", () => {
  it("produces a code of the declared length", () => {
    expect(generateTicketCode()).toHaveLength(TICKET_CODE_LENGTH);
  });

  it("uses only alphabet characters", () => {
    const pattern = new RegExp(`^[${TICKET_CODE_ALPHABET}]+$`);
    for (let i = 0; i < 200; i++) {
      expect(generateTicketCode()).toMatch(pattern);
    }
  });

  it("excludes characters people confuse when reading a code aloud", () => {
    for (const ambiguous of ["I", "L", "O", "U"]) {
      expect(TICKET_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });

  it("does not collide across ten thousand codes", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) seen.add(generateTicketCode());
    expect(seen.size).toBe(10_000);
  });

  it("does not favour any single character", () => {
    // A broken implementation — modulo bias, a stuck byte, a constant — shows
    // up as a wildly uneven distribution. With 12,000 characters over a
    // 32-symbol alphabet each should appear roughly 375 times.
    const counts = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      for (const ch of generateTicketCode()) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(TICKET_CODE_ALPHABET.length);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(150);
      expect(count).toBeLessThan(700);
    }
  });
});

describe("formatTicketCode", () => {
  it("groups the code into readable blocks of four", () => {
    expect(formatTicketCode("K4M92XQP7BTR")).toBe("K4M9-2XQP-7BTR");
  });

  it("round-trips with a generated code", () => {
    const code = generateTicketCode();
    expect(formatTicketCode(code).replace(/-/g, "")).toBe(code);
  });
});

describe("normalizeScannedCode", () => {
  it("strips the display dashes", () => {
    expect(normalizeScannedCode("K4M9-2XQP-7BTR")).toBe("K4M92XQP7BTR");
  });

  it("uppercases a typed code", () => {
    expect(normalizeScannedCode("k4m92xqp7btr")).toBe("K4M92XQP7BTR");
  });

  it("round-trips a formatted generated code", () => {
    const code = generateTicketCode();
    expect(normalizeScannedCode(formatTicketCode(code))).toBe(code);
  });

  it("reduces junk to something that simply will not match", () => {
    expect(normalizeScannedCode("https://example.com")).toBe("HTTPSEXAMPLECOM");
  });
});
