"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ONLY_ERROR, requireAdmin } from "@/lib/auth/require-admin";
import { logActivity } from "@/lib/activity/queries";
import { tally, type Tally } from "@/lib/votes/ballot";
import { allVotes } from "@/lib/votes/queries";
import {
  categoryRevealed,
  setCategoryRevealed,
  setVotingOpen,
  votingOpen,
} from "@/lib/settings/queries";
import { CATEGORIES, CROWD_CHOICE, type Act, type Category } from "@/lib/config/battle";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type Revealed = Record<Category, boolean>;

const MIGRATION_HINT =
  "Couldn't save the change. Paste supabase/migrations/0026_crowds_choice.sql into Supabase first.";

/**
 * Opens or closes voting. Admin-only through requireAdmin() rather than the
 * layout alone — a server action is a POST endpoint reachable without its
 * page (context/RULES.md). Closing never touches votes already cast.
 */
export async function toggleVoting(open: boolean): Promise<ActionResult> {
  const adminId = (await requireAdmin())?.id;
  if (!adminId) return { ok: false, error: ADMIN_ONLY_ERROR };

  if (!(await setVotingOpen(open))) return { ok: false, error: MIGRATION_HINT };

  await logActivity({
    userId: adminId,
    activityType: "voting_toggled",
    description: open ? "Opened Crowd's Choice voting" : "Closed Crowd's Choice voting",
  });

  revalidatePath("/admin/vote");
  return { ok: true };
}

/**
 * Shows or hides one category's winner on the projector. Band and solo are
 * separate so the emcee can announce one and then the other. Does not open or
 * close voting.
 */
export async function toggleReveal(
  category: Category,
  revealed: boolean,
): Promise<ActionResult> {
  const adminId = (await requireAdmin())?.id;
  if (!adminId) return { ok: false, error: ADMIN_ONLY_ERROR };
  // The category comes from a POST body; only the two real ones may become a
  // settings key.
  if (!CATEGORIES.includes(category)) return { ok: false, error: "Unknown category." };

  if (!(await setCategoryRevealed(category, revealed))) {
    return { ok: false, error: MIGRATION_HINT };
  }

  const label = CROWD_CHOICE[category].label.toLowerCase();
  await logActivity({
    userId: adminId,
    activityType: "votes_revealed",
    description: revealed
      ? `Revealed the Crowd's Choice ${label} winner on the projector`
      : `Hid the Crowd's Choice ${label} winner`,
  });

  revalidatePath("/admin/vote");
  return { ok: true };
}

async function readRevealed(): Promise<Revealed> {
  const [band, solo] = await Promise.all([
    categoryRevealed("band"),
    categoryRevealed("solo"),
  ]);
  return { band, solo };
}

export type AdminVoteStatus = {
  open: boolean;
  revealed: Revealed;
  tally: Tally;
};

/** The control page's poll: everything, including the live count per act. */
export async function adminVoteStatus(): Promise<
  { ok: true; status: AdminVoteStatus } | { ok: false; error: string }
> {
  if (!(await requireAdmin())) return { ok: false, error: ADMIN_ONLY_ERROR };

  try {
    const [open, revealed, rows] = await Promise.all([
      votingOpen(),
      readRevealed(),
      allVotes(),
    ]);
    return { ok: true, status: { open, revealed, tally: tally(rows) } };
  } catch {
    return { ok: false, error: "Couldn't load the votes." };
  }
}

export type ProjectorStatus = {
  open: boolean;
  total: number;
  /**
   * Per category: the winning act(s) once revealed, otherwise null. A tie is
   * more than one act. An unrevealed category carries nothing at all, so the
   * room's screen never receives a result early.
   */
  winners: Record<Category, Act[] | null>;
};

/**
 * The projector's poll. Unlike adminVoteStatus this sends no per-act counts,
 * and a category's winner only after an admin presses its Reveal, so nothing
 * the room can see in the page data gives a result away early.
 */
export async function projectorStatus(): Promise<
  { ok: true; status: ProjectorStatus } | { ok: false; error: string }
> {
  if (!(await requireAdmin())) return { ok: false, error: ADMIN_ONLY_ERROR };

  try {
    const [open, revealed, rows] = await Promise.all([
      votingOpen(),
      readRevealed(),
      allVotes(),
    ]);
    const result = tally(rows);
    return {
      ok: true,
      status: {
        open,
        total: result.total,
        winners: {
          band: revealed.band ? result.winners.band : null,
          solo: revealed.solo ? result.winners.solo : null,
        },
      },
    };
  } catch {
    return { ok: false, error: "Couldn't load the votes." };
  }
}
