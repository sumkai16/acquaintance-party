import type { RaffleDrawRow, RaffleEntrant } from "./types";

/**
 * Pure pool/winner bookkeeping — kept separate from ./draw.ts specifically so
 * a client component (raffle-projector.tsx, for latestDraw) never has to pull
 * in node:crypto: webpack fails the whole build the moment anything in the
 * same module as a client import touches a Node builtin, even code the
 * client never calls.
 */
/**
 * The sub-line under a winner's name: "2nd year · B" for a student, the
 * department for a faculty member, and an em dash when there is nothing
 * worth showing.
 *
 * Exists because the projector and the sidebar both used to format
 * `yearLevel · section` inline, which reads as "— · —" for anyone who has no
 * year level — every faculty entrant, and any extra entrant added by name
 * alone.
 */
export function entrantDetail(entrant: RaffleEntrant): string {
  if (entrant.source === "faculty") return entrant.department?.trim() || "Faculty";

  const parts = [entrant.yearLevel, entrant.section].filter(
    (part) => part && part !== "—",
  );
  return parts.length > 0 ? parts.join(" · ") : "—";
}

/**
 * Who a draw may pick from. Scanned students are always in; added names and
 * faculty are each opted in per draw, so the operator can run a
 * students-only prize without touching the lists themselves.
 *
 * Shared by the server action and the projector so the count the operator
 * sees is the pool the draw actually runs on.
 */
export function drawablePool(
  pool: readonly RaffleEntrant[],
  include: { extraEntrants: boolean; faculty: boolean },
): RaffleEntrant[] {
  return pool.filter((entrant) => {
    if (entrant.source === "extra") return include.extraEntrants;
    if (entrant.source === "faculty") return include.faculty;
    return true;
  });
}

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
