"use server";

import { revalidatePath } from "next/cache";
import { drawFromPool } from "@/lib/raffle/draw";
import { currentWinnerIds, excludeEntrants, latestDraw } from "@/lib/raffle/pool";
import { allDraws, eligiblePool, recordDraw } from "@/lib/raffle/queries";
import type { RaffleDrawRow } from "@/lib/raffle/types";
import { currentAdminId } from "@/lib/supabase/server";

export type DrawActionResult =
  | { ok: true; draw: RaffleDrawRow }
  | { ok: false; error: string };

export async function drawNext(input: {
  excludePreviousWinners: boolean;
  includeExtraEntrants: boolean;
}): Promise<DrawActionResult> {
  return runDraw({ ...input, supersedesDrawId: null });
}

export async function redrawLast(input: {
  supersedesDrawId: string;
  excludePreviousWinners: boolean;
  includeExtraEntrants: boolean;
}): Promise<DrawActionResult> {
  return runDraw(input);
}

/**
 * Decides and records one draw in a single request.
 *
 * The row is written before this returns, so the animation the operator is
 * about to run can only ever show a result that is already in the database.
 */
async function runDraw(input: {
  excludePreviousWinners: boolean;
  includeExtraEntrants: boolean;
  supersedesDrawId: string | null;
}): Promise<DrawActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const isRedraw = input.supersedesDrawId !== null;
  const [fullPool, draws] = await Promise.all([eligiblePool(), allDraws()]);
  // Scanned tickets are the pool by default. Extra entrants only join a
  // specific draw when the operator opts them in for it — a per-draw
  // choice, not a global setting.
  const pool = input.includeExtraEntrants
    ? fullPool
    : fullPool.filter((entrant) => entrant.source === "ticket");
  const standing = latestDraw(draws);

  let supersedes: string | null = null;
  if (isRedraw) {
    if (!standing) {
      return { ok: false, error: "Nothing has been drawn yet." };
    }
    // Guards a stale tab: redrawing something that is no longer the standing
    // result would bury a winner nobody meant to replace.
    if (standing.id !== input.supersedesDrawId) {
      return {
        ok: false,
        error: "That result is out of date. Reload the page and try again.",
      };
    }
    supersedes = standing.id;
  }

  const excluded = new Set<string>();
  if (input.excludePreviousWinners) {
    for (const id of currentWinnerIds(draws)) excluded.add(id);
  }
  if (isRedraw && standing) {
    // A redraw replaces a no-show. Never hand the same slot straight back to
    // them, whatever the toggle says.
    excluded.add(standing.winner.registrationId);
  }

  const candidates = excludeEntrants(pool, excluded);
  const outcome = drawFromPool(candidates);

  if (!outcome.ok) {
    return {
      ok: false,
      error:
        pool.length === 0
          ? !input.includeExtraEntrants && fullPool.length > 0
            ? "Nobody with a scanned ticket is eligible yet. Turn on “Include added names” to draw from Setup instead, or wait for check-ins."
            : "Nobody has been scanned in yet, so there is nobody to draw from."
          : "Everyone eligible has already won. Turn off “exclude previous winners” to draw again.",
    };
  }

  const recorded = await recordDraw({
    winner: outcome.winner,
    finalists: outcome.finalists,
    poolSize: candidates.length,
    drawnBy: adminId,
    supersedes,
  });

  if (!recorded.ok) return recorded;

  revalidatePath("/admin/raffle");
  return { ok: true, draw: recorded.draw };
}
