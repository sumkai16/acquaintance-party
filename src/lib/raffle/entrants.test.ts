import { describe, expect, it } from "vitest";
import { findNameCollision, normalizeImportRow } from "./entrants";
import type { RaffleEntrant } from "./types";

function entrant(overrides: Partial<RaffleEntrant> = {}): RaffleEntrant {
  return {
    registrationId: "r1",
    fullName: "Maria Clara Santos",
    yearLevel: "3rd year",
    section: "BSIT-3B",
    source: "ticket",
    ...overrides,
  };
}

describe("normalizeImportRow", () => {
  it("keeps a full row", () => {
    const row = normalizeImportRow({
      fullName: "Juan Dela Cruz",
      yearLevel: "2nd year",
      section: "BSIT-2A",
    });

    expect(row).toEqual({
      fullName: "Juan Dela Cruz",
      yearLevel: "2nd year",
      section: "BSIT-2A",
    });
  });

  it("trims whitespace off every field", () => {
    const row = normalizeImportRow({
      fullName: "  Juan Dela Cruz  ",
      yearLevel: " 2nd year ",
      section: " BSIT-2A ",
    });

    expect(row).toEqual({
      fullName: "Juan Dela Cruz",
      yearLevel: "2nd year",
      section: "BSIT-2A",
    });
  });

  it("defaults missing optional columns to null", () => {
    expect(normalizeImportRow({ fullName: "Juan Dela Cruz" })).toEqual({
      fullName: "Juan Dela Cruz",
      yearLevel: null,
      section: null,
    });
  });

  it("rejects a missing name", () => {
    expect(normalizeImportRow({})).toBeNull();
    expect(normalizeImportRow({ fullName: "" })).toBeNull();
    expect(normalizeImportRow({ fullName: "   " })).toBeNull();
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(normalizeImportRow({ fullName: "J" })).toBeNull();
  });

  it("rejects a name longer than 120 characters", () => {
    expect(normalizeImportRow({ fullName: "J".repeat(121) })).toBeNull();
  });

  it("accepts a numeric-looking spreadsheet cell by coercing to string", () => {
    // A year level typed as a bare "2" in Excel comes back as a number, not
    // a string — a row shouldn't be silently dropped over that.
    expect(normalizeImportRow({ fullName: "Juan Dela Cruz", yearLevel: 2 })).toEqual({
      fullName: "Juan Dela Cruz",
      yearLevel: "2",
      section: null,
    });
  });
});

describe("findNameCollision", () => {
  const pool = [entrant(), entrant({ registrationId: "r2", fullName: "Juan Dela Cruz" })];

  it("finds a match against the ticket pool", () => {
    expect(findNameCollision(pool, "Maria Clara Santos")?.registrationId).toBe("r1");
  });

  it("matches case- and whitespace-insensitively", () => {
    expect(findNameCollision(pool, "  maria CLARA santos  ")?.registrationId).toBe(
      "r1",
    );
  });

  it("finds a match against an existing extra entrant", () => {
    const withExtra = [...pool, entrant({ registrationId: "r3", fullName: "Ana Reyes", source: "extra" })];

    expect(findNameCollision(withExtra, "ana reyes")?.registrationId).toBe("r3");
  });

  it("returns null when nothing matches", () => {
    expect(findNameCollision(pool, "Nobody Here")).toBeNull();
  });
});
