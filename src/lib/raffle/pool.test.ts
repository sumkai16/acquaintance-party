import { describe, expect, it } from "vitest";
import { currentWinnerIds, drawablePool, entrantDetail, latestDraw } from "./pool";
import type { RaffleDrawRow, RaffleEntrant } from "./types";

function entrant(overrides: Partial<RaffleEntrant> = {}): RaffleEntrant {
  return {
    registrationId: "r1",
    fullName: "Maria Clara Santos",
    yearLevel: "3rd year",
    section: "B",
    source: "ticket",
    ...overrides,
  };
}

function draw(overrides: Partial<RaffleDrawRow> = {}): RaffleDrawRow {
  const winner = overrides.winner ?? entrant();
  return {
    id: "d1",
    winner,
    finalists: [winner],
    poolSize: 10,
    drawnAt: "2026-10-03T16:00:00Z",
    isRedraw: false,
    supersedes: null,
    ...overrides,
  };
}

describe("entrantDetail", () => {
  it("pairs year level and section for a student", () => {
    expect(entrantDetail(entrant())).toBe("3rd year · B");
  });

  it("shows the department for a faculty member", () => {
    expect(
      entrantDetail(
        entrant({ source: "faculty", yearLevel: "—", section: "—", department: "BSIT" }),
      ),
    ).toBe("BSIT");
  });

  it("falls back to Faculty when no department was given", () => {
    expect(
      entrantDetail(
        entrant({ source: "faculty", yearLevel: "—", section: "—", department: null }),
      ),
    ).toBe("Faculty");
  });

  it("drops the em-dash placeholders an extra entrant carries", () => {
    expect(entrantDetail(entrant({ source: "extra", yearLevel: "2nd year", section: "—" }))).toBe(
      "2nd year",
    );
    expect(entrantDetail(entrant({ source: "extra", yearLevel: "—", section: "—" }))).toBe("—");
  });
});

/**
 * Students and faculty share one history, so a faculty draw is the latest
 * draw, redrawable, and its winner is excluded from the next one.
 */
describe("one history for students and faculty", () => {
  const studentDraw = draw({ id: "s1", drawnAt: "2026-10-03T16:00:00Z" });
  const facultyDraw = draw({
    id: "f1",
    drawnAt: "2026-10-03T17:00:00Z",
    winner: entrant({ registrationId: "f-entrant", source: "faculty" }),
  });

  it("makes the most recent draw the redrawable one, whoever won it", () => {
    expect(latestDraw([studentDraw])?.id).toBe("s1");
    expect(latestDraw([studentDraw, facultyDraw])?.id).toBe("f1");
  });

  it("excludes both students and faculty who already won", () => {
    expect(currentWinnerIds([studentDraw, facultyDraw])).toEqual(
      new Set(["r1", "f-entrant"]),
    );
  });
});

describe("drawablePool", () => {
  const ticket = entrant({ registrationId: "t", source: "ticket" });
  const extra = entrant({ registrationId: "x", source: "extra" });
  const faculty = entrant({ registrationId: "f", source: "faculty" });
  const everyone = [ticket, extra, faculty];

  it("always keeps scanned students", () => {
    expect(drawablePool(everyone, { extraEntrants: false, faculty: false })).toEqual([ticket]);
  });

  it("opts faculty and added names in separately", () => {
    expect(drawablePool(everyone, { extraEntrants: false, faculty: true })).toEqual([ticket, faculty]);
    expect(drawablePool(everyone, { extraEntrants: true, faculty: false })).toEqual([ticket, extra]);
    expect(drawablePool(everyone, { extraEntrants: true, faculty: true })).toEqual(everyone);
  });
});
