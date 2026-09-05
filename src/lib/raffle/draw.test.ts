import { describe, expect, it } from "vitest";
import { drawFromPool } from "./draw";
import { currentWinnerIds, excludeEntrants, latestDraw } from "./pool";
import type { RaffleDrawRow, RaffleEntrant } from "./types";

function entrant(n: number): RaffleEntrant {
  return {
    registrationId: `r${n}`,
    fullName: `Student ${n}`,
    yearLevel: "3rd year",
    section: "BSIT-3B",
    source: "ticket",
  };
}

const pool = (size: number) =>
  Array.from({ length: size }, (_, i) => entrant(i + 1));

/** Always picks the first still-unpicked entrant, so results are predictable. */
const alwaysZero = () => 0;

function draw(overrides: Partial<RaffleDrawRow>): RaffleDrawRow {
  return {
    id: "d1",
    winner: entrant(1),
    finalists: [entrant(1)],
    poolSize: 1,
    drawnAt: "2026-10-05T19:00:00+08:00",
    isRedraw: false,
    supersedes: null,
    ...overrides,
  };
}

describe("drawFromPool", () => {
  it("shortlists twelve finalists from a large pool", () => {
    const result = drawFromPool(pool(600));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.finalists).toHaveLength(12);
    const ids = new Set(result.finalists.map((f) => f.registrationId));
    expect(ids.size).toBe(12);
  });

  it("only ever shortlists entrants that were in the pool", () => {
    const entrants = pool(50);
    const result = drawFromPool(entrants);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const poolIds = new Set(entrants.map((e) => e.registrationId));
    for (const finalist of result.finalists) {
      expect(poolIds.has(finalist.registrationId)).toBe(true);
    }
  });

  it("picks the winner from among the finalists", () => {
    const result = drawFromPool(pool(600));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.finalists.map((f) => f.registrationId);
    expect(ids).toContain(result.winner.registrationId);
  });

  it("shortlists everyone when the pool is smaller than twelve", () => {
    const result = drawFromPool(pool(5));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.finalists).toHaveLength(5);
    expect(result.finalists.map((f) => f.registrationId).sort()).toEqual([
      "r1",
      "r2",
      "r3",
      "r4",
      "r5",
    ]);
  });

  it("handles a pool of one", () => {
    const result = drawFromPool(pool(1));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.finalists).toHaveLength(1);
    expect(result.winner.registrationId).toBe("r1");
  });

  it("reports an empty pool instead of throwing", () => {
    const result = drawFromPool([]);

    expect(result).toEqual({ ok: false, error: "empty_pool" });
  });

  it("never leaves the pool untouched — it does not mutate its input", () => {
    const entrants = pool(20);
    const before = entrants.map((e) => e.registrationId);

    drawFromPool(entrants);

    expect(entrants.map((e) => e.registrationId)).toEqual(before);
  });

  it("asks the injected RNG only for in-range values", () => {
    // A stub that always returns 0 must produce the pool's first N entrants
    // in order. Anything else means the sampling range is off by one, which
    // is exactly the bug that quietly biases a draw.
    const result = drawFromPool(pool(10), alwaysZero, 3);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.finalists.map((f) => f.registrationId)).toEqual([
      "r1",
      "r2",
      "r3",
    ]);
    expect(result.winner.registrationId).toBe("r1");
  });

  it("gives every entrant a chance with the real generator", () => {
    // Guards against a draw that silently always picks the same index. With
    // a fair draw the odds of missing anyone across 200 trials are nil.
    const winners = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const result = drawFromPool(pool(5), undefined, 5);
      if (result.ok) winners.add(result.winner.registrationId);
    }

    expect(winners.size).toBe(5);
  });
});

describe("excludeEntrants", () => {
  it("removes exactly the excluded entrants", () => {
    const remaining = excludeEntrants(pool(5), new Set(["r2", "r4"]));

    expect(remaining.map((e) => e.registrationId)).toEqual(["r1", "r3", "r5"]);
  });

  it("returns the whole pool when nothing is excluded", () => {
    expect(excludeEntrants(pool(3), new Set())).toHaveLength(3);
  });
});

describe("currentWinnerIds", () => {
  it("drops a winner whose draw was superseded by a redraw", () => {
    const original = draw({ id: "d1", winner: entrant(1) });
    const replacement = draw({
      id: "d2",
      winner: entrant(2),
      isRedraw: true,
      supersedes: "d1",
    });

    const ids = currentWinnerIds([original, replacement]);

    expect(ids.has("r1")).toBe(false);
    expect(ids.has("r2")).toBe(true);
  });

  it("collects winners across draws", () => {
    const ids = currentWinnerIds([
      draw({ id: "d1", winner: entrant(1) }),
      draw({ id: "d2", winner: entrant(2) }),
    ]);

    expect([...ids].sort()).toEqual(["r1", "r2"]);
  });
});

describe("latestDraw", () => {
  it("returns the redraw rather than the draw it replaced", () => {
    const original = draw({ id: "d1", drawnAt: "2026-10-05T19:00:00+08:00" });
    const replacement = draw({
      id: "d2",
      drawnAt: "2026-10-05T19:05:00+08:00",
      isRedraw: true,
      supersedes: "d1",
      winner: entrant(2),
    });

    const latest = latestDraw([original, replacement]);

    expect(latest?.id).toBe("d2");
  });

  it("returns null when nothing has been drawn", () => {
    expect(latestDraw([])).toBeNull();
  });
});
