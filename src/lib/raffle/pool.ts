import type { RaffleDrawRow, RaffleEntrant } from "./types";

/**
 * Pure pool/winner bookkeeping — kept separate from ./draw.ts specifically so
 * a client component (raffle-projector.tsx, for latestDraw) never has to pull
 * in node:crypto: webpack fails the whole build the moment anything in the
 * same module as a client import touches a Node builtin, even code the
 * client never calls.
 */
export function excludeEntrants(
  pool: readonly RaffleEntrant[],
  excludedIds: ReadonlySet<string>,
): RaffleEntrant[] {
  return pool.filter((entrant) => !excludedIds.has(entrant.registrationId));
}

function supersededIds(draws: readonly RaffleDrawRow[]): Set<string> {
  const ids = new Set<string>();
  for (const row of draws) {
    if (row.supersedes) ids.add(row.supersedes);
  }
  return ids;
}

/** Winners as they currently stand — a replaced no-show is not a winner. */
export function currentWinnerIds(
  draws: readonly RaffleDrawRow[],
): Set<string> {
  const replaced = supersededIds(draws);

  return new Set(
    draws
      .filter((row) => !replaced.has(row.id))
      .map((row) => row.winner.registrationId),
  );
}

/**
 * The most recent draw overall, or null if nothing has been drawn yet.
 * Decides whether the operator sees a Redraw button, and supplies the id a
 * redraw supersedes — only the latest draw is ever redrawable, so unlike a
 * per-prize lookup this needs no key.
 */
export function latestDraw(draws: readonly RaffleDrawRow[]): RaffleDrawRow | null {
  return draws.reduce<RaffleDrawRow | null>((latest, row) => {
    return !latest || row.drawnAt > latest.drawnAt ? row : latest;
  }, null);
}
