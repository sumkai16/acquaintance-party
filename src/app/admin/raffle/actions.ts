"use server";

import { revalidatePath } from "next/cache";
import {
  currentWinnerIds,
  drawFromPool,
  excludeEntrants,
  latestDrawForPrize,
} from "@/lib/raffle/draw";
import {
  allDraws,
  eligiblePool,
  getPrizeById,
  recordDraw,
} from "@/lib/raffle/queries";
import type { RaffleDrawRow } from "@/lib/raffle/types";
import { currentAdminId } from "@/lib/supabase/server";

export type DrawActionResult =
  | { ok: true; draw: RaffleDrawRow }
  | { ok: false; error: string };

export async function drawPrize(input: {
  prizeKey: string;
  excludePreviousWinners: boolean;
  onlyScannedTickets: boolean;
}): Promise<DrawActionResult> {
  return runDraw({ ...input, supersedesDrawId: null });
}

export async function redrawPrize(input: {
  prizeKey: string;
  supersedesDrawId: string;
  excludePreviousWinners: boolean;
  onlyScannedTickets: boolean;
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
  prizeKey: string;
  excludePreviousWinners: boolean;
  onlyScannedTickets: boolean;
  supersedesDrawId: string | null;
}): Promise<DrawActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const prize = await getPrizeById(input.prizeKey);
  if (!prize) return { ok: false, error: "That prize is not in the prize list." };

  const isRedraw = input.supersedesDrawId !== null;
  const [fullPool, draws] = await Promise.all([eligiblePool(), allDraws()]);
  // Per-draw choice, not a global setting: the operator decides each time
  // whether admin-added names are in the running, or this prize is strictly
  // for people with a scanned ticket.
  const pool = input.onlyScannedTickets
    ? fullPool.filter((entrant) => entrant.source === "ticket")
    : fullPool;
  const standing = latestDrawForPrize(draws, prize.id);

  let supersedes: string | null = null;
  if (isRedraw) {
    if (!standing) {
      return { ok: false, error: `${prize.name} has not been drawn yet.` };
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
  } else if (standing) {
    // Without this, a second draw lands as another fresh row and reads
    // exactly like an untagged rerun — the thing `supersedes` exists to stop.
    return {
      ok: false,
      error: `${prize.name} has already been drawn. Use Redraw if the winner did not show up.`,
    };
  }

  const excluded = new Set<string>();
  if (input.excludePreviousWinners) {
    for (const id of currentWinnerIds(draws)) excluded.add(id);
  }
  if (isRedraw) {
    // A redraw replaces a no-show. Never hand the same prize straight back
    // to them, whatever the toggle says.
    for (const row of draws) {
      if (row.prizeKey === prize.id) excluded.add(row.winner.registrationId);
    }
  }

  const candidates = excludeEntrants(pool, excluded);
  const outcome = drawFromPool(candidates);

  if (!outcome.ok) {
    return {
      ok: false,
      error:
        pool.length === 0
          ? input.onlyScannedTickets && fullPool.length > 0
            ? "Nobody with a scanned ticket is eligible yet. Turn off “Only scanned tickets” to include added names, or wait for check-ins."
            : "Nobody has been scanned in yet, so there is nobody to draw from."
          : "Everyone eligible has already won. Turn off “exclude previous winners” to draw again.",
    };
  }

  const recorded = await recordDraw({
    prizeKey: prize.id,
    prizeName: prize.name,
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
