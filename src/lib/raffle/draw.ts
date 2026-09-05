import { randomInt as cryptoRandomInt } from "node:crypto";
import type { RaffleEntrant } from "./types";

// Pool/winner bookkeeping (excludeEntrants, currentWinnerIds, latestDraw)
// lives in ./pool.ts, not here — that module is imported from a client
// component, and node:crypto has no browser bundle. See pool.ts's header.

export const FINALIST_COUNT = 12;

/**
 * Returns a uniform integer in [0, maxExclusive).
 *
 * Matches node:crypto's randomInt contract exactly, so the production
 * default and a test stub are interchangeable. Injected only so tests can
 * make a draw deterministic — never to swap in Math.random.
 */
export type RandomInt = (maxExclusive: number) => number;

export type DrawOutcome =
  | { ok: true; finalists: RaffleEntrant[]; winner: RaffleEntrant }
  | { ok: false; error: "empty_pool" };

/**
 * Shortlists finalists and picks the winner from among them, together, in
 * one call — so the whole outcome is settled before anything can animate.
 *
 * node:crypto's randomInt is already rejection-sampled, so unlike the ticket
 * code generator this needs no hand-rolled masking to stay unbiased.
 */
export function drawFromPool(
  pool: readonly RaffleEntrant[],
  randomInt: RandomInt = cryptoRandomInt,
  finalistCount: number = FINALIST_COUNT,
): DrawOutcome {
  if (pool.length === 0) return { ok: false, error: "empty_pool" };

  const remaining = [...pool];
  const take = Math.min(finalistCount, remaining.length);
  const finalists: RaffleEntrant[] = [];

  // Partial Fisher-Yates: swap a uniformly chosen entrant from the unpicked
  // tail into position i. Every entrant is equally likely to be shortlisted,
  // and the finalists come out already shuffled, so the reveal order is not
  // the order they registered in.
  for (let i = 0; i < take; i++) {
    const pick = i + randomInt(remaining.length - i);
    [remaining[i], remaining[pick]] = [remaining[pick], remaining[i]];
    finalists.push(remaining[i]);
  }

  return {
    ok: true,
    finalists,
    winner: finalists[randomInt(finalists.length)],
  };
}
