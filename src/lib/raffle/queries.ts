import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { approvedManifest } from "@/lib/scans/queries";
import type { RaffleDrawRow, RaffleEntrant } from "./types";

/**
 * Everyone eligible: approved, and actually scanned in at the door.
 *
 * Reuses the manifest rather than re-deriving the join. "Checked in" has one
 * definition in this codebase and a second copy of it would drift the moment
 * the scan model changes.
 *
 * A scanner phone that has not synced yet is invisible here, exactly as it is
 * on the dashboard — which is why the projector shows this count next to the
 * dashboard's before anyone spins.
 */
export async function eligiblePool(): Promise<RaffleEntrant[]> {
  const manifest = await approvedManifest();

  return manifest.entries
    .filter((entry) => entry.checkedInAt !== null)
    .map((entry) => ({
      registrationId: entry.registrationId,
      fullName: entry.fullName,
      yearLevel: entry.yearLevel,
      section: entry.section,
    }));
}

type DrawRecord = {
  id: string;
  prize_key: string;
  prize_name: string;
  winner_registration_id: string;
  finalists: RaffleEntrant[];
  pool_size: number;
  drawn_at: string;
  is_redraw: boolean;
  supersedes: string | null;
};

function toDrawRow(row: DrawRecord): RaffleDrawRow | null {
  const winner = row.finalists.find(
    (entrant) => entrant.registrationId === row.winner_registration_id,
  );

  // The draw action can't produce this — it picks the winner out of the
  // finalists it stores. A row hand-written in the SQL editor can, and the
  // projector should skip it rather than render an undefined name.
  if (!winner) {
    console.error("raffle draw has a winner outside its finalists", row.id);
    return null;
  }

  return {
    id: row.id,
    prizeKey: row.prize_key,
    prizeName: row.prize_name,
    winner,
    finalists: row.finalists,
    poolSize: row.pool_size,
    drawnAt: row.drawn_at,
    isRedraw: row.is_redraw,
    supersedes: row.supersedes,
  };
}

/** Every draw ever recorded, oldest first. */
export async function allDraws(): Promise<RaffleDrawRow[]> {
  const { data, error } = await adminClient()
    .from("raffle_draws")
    .select(
      "id, prize_key, prize_name, winner_registration_id, finalists, pool_size, drawn_at, is_redraw, supersedes",
    )
    .order("drawn_at", { ascending: true });

  if (error) {
    console.error("allDraws failed", error);
    throw new Error("Could not load the raffle history.");
  }

  return (data ?? [])
    .map((row) => toDrawRow(row as unknown as DrawRecord))
    .filter((row): row is RaffleDrawRow => row !== null);
}

export type RecordDrawInput = {
  prizeKey: string;
  prizeName: string;
  winner: RaffleEntrant;
  finalists: RaffleEntrant[];
  poolSize: number;
  drawnBy: string;
  supersedes: string | null;
};

export async function recordDraw(
  input: RecordDrawInput,
): Promise<{ ok: true; draw: RaffleDrawRow } | { ok: false; error: string }> {
  const { data, error } = await adminClient()
    .from("raffle_draws")
    .insert({
      prize_key: input.prizeKey,
      prize_name: input.prizeName,
      winner_registration_id: input.winner.registrationId,
      finalists: input.finalists,
      pool_size: input.poolSize,
      drawn_by: input.drawnBy,
      is_redraw: input.supersedes !== null,
      supersedes: input.supersedes,
    })
    .select(
      "id, prize_key, prize_name, winner_registration_id, finalists, pool_size, drawn_at, is_redraw, supersedes",
    )
    .single();

  if (error || !data) {
    console.error("recordDraw failed", error);
    return { ok: false, error: "Could not record the draw. Try again." };
  }

  const draw = toDrawRow(data as unknown as DrawRecord);
  if (!draw) return { ok: false, error: "Could not record the draw. Try again." };

  return { ok: true, draw };
}
