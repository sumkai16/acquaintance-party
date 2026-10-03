import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { approvedManifest } from "@/lib/scans/queries";
import { listAcknowledgements } from "@/lib/faculty/queries";
import type { ParsedEntrantRow } from "./entrants";
import type { RaffleDrawRow, RaffleEntrant } from "./types";

/**
 * Everyone eligible: the auto pool of approved, scanned-in students, plus
 * any admin-added extras.
 *
 * The auto half reuses the manifest rather than re-deriving the join.
 * "Checked in" has one definition in this codebase and a second copy of it
 * would drift the moment the scan model changes. A scanner phone that has
 * not synced yet is invisible here, exactly as it is on the dashboard —
 * which is why the projector shows this count next to the dashboard's
 * before anyone spins.
 *
 * The extras half is the explicit escape hatch: someone the scanner missed,
 * or a name from an imported list. It stays a visibly separate addition,
 * never a replacement for the scan-based default.
 */
export async function eligiblePool(): Promise<RaffleEntrant[]> {
  const [manifest, extras] = await Promise.all([
    approvedManifest(),
    listExtraEntrants(),
  ]);

  const ticketPool: RaffleEntrant[] = manifest.entries
    .filter((entry) => entry.checkedInAt !== null)
    .map((entry) => ({
      registrationId: entry.registrationId,
      fullName: entry.fullName,
      yearLevel: entry.yearLevel,
      section: entry.section,
      source: "ticket",
    }));

  return [...ticketPool, ...extras];
}

/**
 * Every faculty member who acknowledged the invitation.
 *
 * Unlike the student pool there is no attendance gate — acknowledging the
 * letter is the whole entry, by explicit choice (2026-09-20), so a faculty
 * member who never turns up can still win and the emcee redraws on the spot.
 */
export async function facultyPool(): Promise<RaffleEntrant[]> {
  const entries = await listAcknowledgements();

  return entries.map((entry) => ({
    registrationId: entry.id,
    fullName: entry.full_name,
    yearLevel: "—",
    section: "—",
    source: "faculty",
    department: entry.department,
  }));
}

/**
 * Everyone who can be drawn: students and faculty in one pool, as the
 * instructor asked on 2026-10-01. Each entrant keeps its `source`, which is
 * how a draw leaves faculty (or added names) out when the operator switches
 * them off — see `drawablePool()` in ./pool.ts.
 */
export async function fullPool(): Promise<RaffleEntrant[]> {
  const [students, faculty] = await Promise.all([eligiblePool(), facultyPool()]);
  return [...students, ...faculty];
}

/** Extra entrants as `RaffleEntrant`s, ready to fold into the pool. */
export async function listExtraEntrants(): Promise<RaffleEntrant[]> {
  const { data, error } = await adminClient()
    .from("raffle_extra_entrants")
    .select("id, full_name, year_level, section")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listExtraEntrants failed", error);
    throw new Error("Could not load the extra entrant list.");
  }

  return (data ?? []).map((row) => ({
    registrationId: row.id as string,
    fullName: row.full_name as string,
    yearLevel: (row.year_level as string | null) ?? "—",
    section: (row.section as string | null) ?? "—",
    source: "extra",
  }));
}

export async function insertExtraEntrant(
  row: ParsedEntrantRow,
  addedBy: string,
  source: "manual" | "import" = "manual",
): Promise<{ ok: true; entrant: RaffleEntrant } | { ok: false; error: string }> {
  const { data, error } = await adminClient()
    .from("raffle_extra_entrants")
    .insert({
      full_name: row.fullName,
      year_level: row.yearLevel,
      section: row.section,
      source,
      added_by: addedBy,
    })
    .select("id, full_name, year_level, section")
    .single();

  if (error || !data) {
    console.error("insertExtraEntrant failed", error);
    return { ok: false, error: "Could not add that name. Try again." };
  }

  return {
    ok: true,
    entrant: {
      registrationId: data.id as string,
      fullName: data.full_name as string,
      yearLevel: (data.year_level as string | null) ?? "—",
      section: (data.section as string | null) ?? "—",
      source: "extra",
    },
  };
}

export async function insertExtraEntrantsBatch(
  rows: ParsedEntrantRow[],
  addedBy: string,
): Promise<{ ok: true; entrants: RaffleEntrant[] } | { ok: false; error: string }> {
  if (rows.length === 0) return { ok: true, entrants: [] };

  const { data, error } = await adminClient()
    .from("raffle_extra_entrants")
    .insert(
      rows.map((row) => ({
        full_name: row.fullName,
        year_level: row.yearLevel,
        section: row.section,
        source: "import",
        added_by: addedBy,
      })),
    )
    .select("id, full_name, year_level, section");

  if (error) {
    console.error("insertExtraEntrantsBatch failed", error);
    return { ok: false, error: "Could not import the list. Try again." };
  }

  return {
    ok: true,
    entrants: (data ?? []).map((row) => ({
      registrationId: row.id as string,
      fullName: row.full_name as string,
      yearLevel: (row.year_level as string | null) ?? "—",
      section: (row.section as string | null) ?? "—",
      source: "extra" as const,
    })),
  };
}

export async function deleteExtraEntrant(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await adminClient().from("raffle_extra_entrants").delete().eq("id", id);

  if (error) {
    console.error("deleteExtraEntrant failed", error);
    return { ok: false, error: "Could not remove that entrant. Try again." };
  }
  return { ok: true };
}

type DrawRecord = {
  id: string;
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
    winner,
    finalists: row.finalists,
    poolSize: row.pool_size,
    drawnAt: row.drawn_at,
    isRedraw: row.is_redraw,
    supersedes: row.supersedes,
  };
}

/**
 * Every draw recorded, oldest first — one history for the whole night.
 *
 * Draws made while students and faculty had separate raffles carry an
 * `audience` on the row (`0017`); nothing reads it any more, and every new
 * draw takes the column's default.
 */
export async function allDraws(): Promise<RaffleDrawRow[]> {
  const { data, error } = await adminClient()
    .from("raffle_draws")
    .select(
      "id, winner_registration_id, finalists, pool_size, drawn_at, is_redraw, supersedes",
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
      winner_registration_id: input.winner.registrationId,
      finalists: input.finalists,
      pool_size: input.poolSize,
      drawn_by: input.drawnBy,
      is_redraw: input.supersedes !== null,
      supersedes: input.supersedes,
    })
    .select(
      "id, winner_registration_id, finalists, pool_size, drawn_at, is_redraw, supersedes",
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

/**
 * Wipes the whole draw history — every winner and every replaced no-show.
 * Used by "Reset winners" when the night is rehearsed and the real raffle
 * starts clean. Not undoable, so the caller confirms first.
 *
 * One statement, so the self-reference from `supersedes` is only checked once
 * every row is gone. Added names and faculty are untouched.
 */
export async function deleteAllDraws(): Promise<
  { ok: true; removed: number } | { ok: false; error: string }
> {
  const { error, count } = await adminClient()
    .from("raffle_draws")
    .delete({ count: "exact" })
    .not("id", "is", null);

  if (error) {
    console.error("deleteAllDraws failed", error);
    return { ok: false, error: "Could not reset the winners. Try again." };
  }
  return { ok: true, removed: count ?? 0 };
}
