import { describe, expect, it } from "vitest";
import { buildIndex, resolveScan, type Manifest } from "./resolve";

const manifest: Manifest = {
  generatedAt: "2026-10-05T16:00:00+08:00",
  entries: [
    {
      code: "K4M92XQP7BTR",
      registrationId: "11111111-1111-1111-1111-111111111111",
      fullName: "Maria Clara Santos",
      yearLevel: "3rd year",
      section: "BSIT-3B",
    },
    {
      code: "V0GW3DP59EZF",
      registrationId: "22222222-2222-2222-2222-222222222222",
      fullName: "Juan Dela Cruz",
      yearLevel: "2nd year",
      section: "BSIT-2A",
    },
  ],
};

const index = buildIndex(manifest);
const nothingScanned = new Map<string, string>();

describe("resolveScan", () => {
  it("admits a valid, unscanned ticket", () => {
    const result = resolveScan("K4M92XQP7BTR", index, nothingScanned);
    expect(result.result).toBe("ok");
    if (result.result === "ok") {
      expect(result.entry.fullName).toBe("Maria Clara Santos");
    }
  });

  it("accepts the dashed form the ticket page displays", () => {
    // The QR encodes the bare code, but a volunteer may type what they see.
    expect(resolveScan("K4M9-2XQP-7BTR", index, nothingScanned).result).toBe("ok");
  });

  it("accepts lowercase, since a typed code is not guaranteed uppercase", () => {
    expect(resolveScan("k4m92xqp7btr", index, nothingScanned).result).toBe("ok");
  });

  it("flags a second scan of the same ticket as a duplicate", () => {
    const scanned = new Map([["K4M92XQP7BTR", "2026-10-05T20:14:00+08:00"]]);
    const result = resolveScan("K4M92XQP7BTR", index, scanned);
    expect(result.result).toBe("duplicate");
    if (result.result === "duplicate") {
      expect(result.firstScannedAt).toBe("2026-10-05T20:14:00+08:00");
      // The volunteer still needs the name to resolve the dispute in person.
      expect(result.entry.fullName).toBe("Maria Clara Santos");
    }
  });

  it("rejects a code that is not on the manifest", () => {
    const result = resolveScan("ZZZZZZZZZZZZ", index, nothingScanned);
    expect(result.result).toBe("invalid");
    if (result.result === "invalid") {
      expect(result.code).toBe("ZZZZZZZZZZZZ");
    }
  });

  it("rejects an arbitrary QR code from something else entirely", () => {
    expect(resolveScan("https://example.com", index, nothingScanned).result).toBe(
      "invalid",
    );
  });

  it("rejects an empty read rather than throwing", () => {
    expect(resolveScan("", index, nothingScanned).result).toBe("invalid");
  });

  it("keeps each ticket independent", () => {
    const scanned = new Map([["K4M92XQP7BTR", "2026-10-05T20:14:00+08:00"]]);
    expect(resolveScan("V0GW3DP59EZF", index, scanned).result).toBe("ok");
  });
});

describe("buildIndex", () => {
  it("indexes every manifest entry by its code", () => {
    expect(index.size).toBe(2);
    expect(index.get("K4M92XQP7BTR")?.section).toBe("BSIT-3B");
  });

  it("survives an empty manifest", () => {
    expect(buildIndex({ generatedAt: "", entries: [] }).size).toBe(0);
  });
});
