import { describe, expect, it } from "vitest";
import { currentWinnerIds, entrantDetail, latestDraw } from "./pool";
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
 * These two are what make the per-audience split work: allDraws() filters by
 * audience, so passing a faculty-only list here is what scopes the redraw and
 * the winner exclusions to faculty. Nothing in either function knows about
 * audiences, and that is the point.
 */
describe("scoping by the draws passed in", () => {
  const studentDraw = draw({ id: "s1", drawnAt: "2026-10-03T16:00:00Z" });
  const facultyDraw = draw({
    id: "f1",
    drawnAt: "2026-10-03T17:00:00Z",
    winner: entrant({ registrationId: "f-entrant", source: "faculty" }),
  });

  it("makes the latest student draw redrawable even after a faculty draw", () => {
    expect(latestDraw([studentDraw])?.id).toBe("s1");
    // The bug this guards: one combined list hands back the faculty draw,
    // so the student draw before it silently stops being redrawable.
    expect(latestDraw([studentDraw, facultyDraw])?.id).toBe("f1");
  });

  it("keeps each audience's winners out of only its own pool", () => {
    expect(currentWinnerIds([studentDraw])).toEqual(new Set(["r1"]));
    expect(currentWinnerIds([facultyDraw])).toEqual(new Set(["f-entrant"]));
  });
});
