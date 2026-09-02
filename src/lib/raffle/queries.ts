import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { approvedManifest } from "@/lib/scans/queries";
import type { ParsedEntrantRow } from "./entrants";
import type { RaffleDrawRow, RaffleEntrant, RafflePrize } from "./types";

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

/** Every prize, in draw order. */
export async function listPrizes(): Promise<RafflePrize[]> {
  const { data, error } = await adminClient()
    .from("raffle_prizes")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("listPrizes failed", error);
    throw new Error("Could not load the prize list.");
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    sortOrder: row.sort_order as number,
  }));
}

export async function getPrizeById(id: string): Promise<RafflePrize | null> {
  const { data, error } = await adminClient()
    .from("raffle_prizes")
    .select("id, name, sort_order")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getPrizeById failed", error);
    return null;
  }
  if (!data) return null;

  return { id: data.id as string, name: data.name as string, sortOrder: data.sort_order as number };
}

export async function insertPrize(
  name: string,
): Promise<{ ok: true; prize: RafflePrize } | { ok: false; error: string }> {
  const existing = await listPrizes();
  const nextOrder = existing.length === 0
    ? 0
    : Math.max(...existing.map((p) => p.sortOrder)) + 1;

  const { data, error } = await adminClient()
    .from("raffle_prizes")
    .insert({ name, sort_order: nextOrder })
    .select("id, name, sort_order")
    .single();

  if (error || !data) {
    console.error("insertPrize failed", error);
    return { ok: false, error: "Could not add the prize. Try again." };
  }

  return {
    ok: true,
    prize: { id: data.id as string, name: data.name as string, sortOrder: data.sort_order as number },
  };
}

export async function renamePrizeById(
  id: string,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await adminClient().from("raffle_prizes").update({ name }).eq("id", id);

  if (error) {
    console.error("renamePrizeById failed", error);
    return { ok: false, error: "Could not rename the prize. Try again." };
  }
  return { ok: true };
}

export async function deletePrizeById(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await adminClient().from("raffle_prizes").delete().eq("id", id);

  if (error) {
    console.error("deletePrizeById failed", error);
    return { ok: false, error: "Could not delete the prize. Try again." };
  }
  return { ok: true };
}

/** Swaps a prize's sort position with its neighbor. A no-op at either end. */
export async function movePrize(
  id: string,
  direction: "up" | "down",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prizes = await listPrizes();
  const index = prizes.findIndex((p) => p.id === id);
  if (index === -1) return { ok: false, error: "That prize no longer exists." };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= prizes.length) return { ok: true }; // already at the end

  const a = prizes[index];
  const b = prizes[swapIndex];

  const { error } = await adminClient()
    .from("raffle_prizes")
    .upsert([
      { id: a.id, name: a.name, sort_order: b.sortOrder },
      { id: b.id, name: b.name, sort_order: a.sortOrder },
    ]);

  if (error) {
    console.error("movePrize failed", error);
    return { ok: false, error: "Could not reorder prizes. Try again." };
  }
  return { ok: true };
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
