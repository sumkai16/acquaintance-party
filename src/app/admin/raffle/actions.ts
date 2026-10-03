"use server";

import { revalidatePath } from "next/cache";
import { drawFromPool } from "@/lib/raffle/draw";
import { currentWinnerIds, drawablePool, excludeEntrants, latestDraw } from "@/lib/raffle/pool";
import { logActivity } from "@/lib/activity/queries";
import { allDraws, deleteAllDraws, fullPool, recordDraw } from "@/lib/raffle/queries";
import type { RaffleDrawRow } from "@/lib/raffle/types";
import { ADMIN_ONLY_ERROR, requireAdmin } from "@/lib/auth/require-admin";

export type DrawActionResult =
  | { ok: true; draw: RaffleDrawRow }
  | { ok: false; error: string };

export async function drawNext(input: {
  excludePreviousWinners: boolean;
  includeExtraEntrants: boolean;
  includeFaculty: boolean;
}): Promise<DrawActionResult> {
  return runDraw({ ...input, supersedesDrawId: null });
}

export async function redrawLast(input: {
  supersedesDrawId: string;
  excludePreviousWinners: boolean;
  includeExtraEntrants: boolean;
  includeFaculty: boolean;
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
  includeFaculty: boolean;
  supersedesDrawId: string | null;
}): Promise<DrawActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: ADMIN_ONLY_ERROR };
  const adminId = admin.id;

  const isRedraw = input.supersedesDrawId !== null;
  // One pool and one history for students and faculty together, so a redraw,
  // the winner exclusions and the sidebar list all see the whole night.
  const [everyone, draws] = await Promise.all([fullPool(), allDraws()]);
  // Scanned tickets are the pool by default. Added names and faculty only
  // join a specific draw when the operator opts them in for it — a per-draw
  // choice, not a global setting.
  const pool = drawablePool(everyone, {
    extraEntrants: input.includeExtraEntrants,
    faculty: input.includeFaculty,
  });
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
    return { ok: false, error: emptyPoolError(input, pool.length, everyone.length) };
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

/**
 * Why the draw found nobody — three different fixes, so three different
 * sentences rather than one vague "no entries". Read at the podium with a
 * room waiting, so each one names the next action.
 */
function emptyPoolError(
  input: { includeExtraEntrants: boolean; includeFaculty: boolean },
  poolSize: number,
  everyoneSize: number,
): string {
  if (poolSize > 0) {
    return "Everyone eligible has already won. Turn off “exclude previous winners” to draw again.";
  }

  // Someone exists but is switched off for this draw — name the switch.
  if (everyoneSize > 0 && !(input.includeExtraEntrants && input.includeFaculty)) {
    return "Nobody with a scanned ticket is eligible yet. Turn on “Include faculty” or “Include added names” to draw from them too, or wait for check-ins.";
  }

  return "Nobody has been scanned in yet, so there is nobody to draw from.";
}

/**
 * Clears every winner so the raffle starts again from nothing. Admin-only
 * through requireAdmin() itself, not just the page, since a server action is
 * reachable without its page (context/RULES.md). The activity row records who
 * did it and how many winners went.
 */
export async function resetRaffle(): Promise<
  { ok: true; removed: number } | { ok: false; error: string }
> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: ADMIN_ONLY_ERROR };

  const result = await deleteAllDraws();
  if (!result.ok) return result;

  await logActivity({
    userId: admin.id,
    activityType: "raffle_reset",
    description: `Reset the raffle: cleared ${result.removed} draw${result.removed === 1 ? "" : "s"}`,
  });

  revalidatePath("/admin/raffle");
  return result;
}
