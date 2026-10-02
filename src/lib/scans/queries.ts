import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { allRows } from "@/lib/supabase/all-rows";
import type { Manifest } from "./manifest";
import type { ScanRecord } from "./report";
import type { ScanResult } from "@/lib/supabase/types";

export type ScanRow = {
  id: string;
  registrationId: string | null;
  codeScanned: string;
  scannedAt: string;
  deviceLabel: string;
  result: ScanResult;
};

/**
 * Every ticket the door should admit, in the minimal shape the scanner
 * caches, with the earliest known "ok" scan time per ticket so a second
 * device can recognize a ticket another device already admitted — as long as
 * both are online. That is every approved ticket, plus a partial payer an
 * admin sent their QR before the balance was paid: the `not null` on
 * ticket_code is what keeps a partial payer with no QR out.
 */
export async function approvedManifest(): Promise<Manifest> {
  // Page by page (allRows): the API cuts a longer table off at 1000 rows
  // without a word, and a ticket missing from this list is a student the
  // scanner turns away at the door.
  let registrations;
  let checkIns;
  try {
    [registrations, checkIns] = await Promise.all([
      allRows((from, to) =>
        adminClient()
          .from("registrations")
          .select("id, ticket_code, full_name, year_level, section")
          .in("status", ["approved", "partial"])
          .not("ticket_code", "is", null)
          .order("id")
          .range(from, to),
      ),
      allRows((from, to) =>
        adminClient()
          .from("scans")
          .select("registration_id, scanned_at")
          .eq("result", "ok")
          .not("registration_id", "is", null)
          .order("id")
          .range(from, to),
      ),
    ]);
  } catch (error) {
    console.error("approvedManifest failed", error);
    throw new Error("Could not load the ticket manifest.");
  }

  const earliestCheckIn = new Map<string, string>();
  for (const row of checkIns) {
    const id = row.registration_id as string;
    const at = row.scanned_at as string;
    const existing = earliestCheckIn.get(id);
    if (!existing || at < existing) earliestCheckIn.set(id, at);
  }

  return {
    generatedAt: new Date().toISOString(),
    entries: registrations.map((row) => ({
      code: row.ticket_code as string,
      registrationId: row.id as string,
      fullName: row.full_name as string,
      yearLevel: row.year_level as string,
      section: row.section as string,
      checkedInAt: earliestCheckIn.get(row.id as string) ?? null,
    })),
  };
}

/** A scan this call actually wrote — not one a retry re-sent. */
export type InsertedScan = {
  registrationId: string | null;
  codeScanned: string;
  scannedAt: string;
  syncedAt: string;
  deviceLabel: string;
  result: ScanResult;
};

/**
 * Inserts a batch of queued scans.
 *
 * The client generates each `id`, so a retried batch upserts onto the same
 * rows instead of double-counting attendance. `ignoreDuplicates` means a
 * re-sync is a no-op rather than an error — the scanner retries blindly on an
 * interval and must never be punished for it.
 *
 * `inserted` carries only the rows this call created, because `on conflict do
 * nothing` returns nothing for rows it skipped. Anything downstream that must
 * happen once per scan — the Sheets append — keys off that, not off `rows`,
 * or a retry publishes the same student again.
 */
export async function recordScans(
  rows: ScanRow[],
): Promise<
  | { ok: true; accepted: number; inserted: InsertedScan[] }
  | { ok: false; error: string }
> {
  if (rows.length === 0) return { ok: true, accepted: 0, inserted: [] };

  const { data, error } = await adminClient()
    .from("scans")
    .upsert(
      rows.map((row) => ({
        id: row.id,
        registration_id: row.registrationId,
        code_scanned: row.codeScanned,
        scanned_at: row.scannedAt,
        device_label: row.deviceLabel,
        result: row.result,
      })),
      { onConflict: "id", ignoreDuplicates: true },
    )
    .select(
      "registration_id, code_scanned, scanned_at, synced_at, device_label, result",
    );

  if (error) {
    console.error("recordScans failed", error);
    return { ok: false, error: "Could not save scans." };
  }

  return {
    ok: true,
    accepted: rows.length,
    inserted: (data ?? []).map((row) => ({
      registrationId: row.registration_id as string | null,
      codeScanned: row.code_scanned as string,
      scannedAt: row.scanned_at as string,
      syncedAt: row.synced_at as string,
      deviceLabel: row.device_label as string,
      result: row.result as ScanResult,
    })),
  };
}

/** Every scan with the student's name joined in, newest first. */
export async function allScans(): Promise<ScanRecord[]> {
  let data;
  try {
    // Paged: a night with ~800 tickets plus duplicate and invalid scans can
    // pass 1000 rows, and the API would cut the *oldest* off — the first
    // arrivals — and quietly under-report attendance. `id` breaks ties in
    // scanned_at so pages never overlap.
    data = await allRows((from, to) =>
      adminClient()
        .from("scans")
        .select(
          "code_scanned, scanned_at, device_label, result, registration_id, registrations(full_name, year_level, section)",
        )
        .order("scanned_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
  } catch (error) {
    console.error("allScans failed", error);
    return [];
  }

  return data.map((row) => {
    // registrations is a to-one embed at runtime (registration_id is a single
    // FK), but without generated DB types the client infers it as an array —
    // hence the trip through `unknown` rather than a direct cast.
    const registration = row.registrations as unknown as {
      full_name: string;
      year_level: string;
      section: string;
    } | null;

    return {
      registrationId: row.registration_id as string | null,
      fullName: registration?.full_name ?? null,
      yearLevel: registration?.year_level ?? null,
      section: registration?.section ?? null,
      codeScanned: row.code_scanned as string,
      scannedAt: row.scanned_at as string,
      deviceLabel: row.device_label as string,
      result: row.result as ScanRecord["result"],
    };
  });
}

/**
 * How many people hold a ticket the door will admit — approved, plus partial
 * payers who were sent their QR. Same definition as approvedManifest above, so
 * the "expected" numbers on Attendance, the Dashboard and the raffle never
 * disagree with what the scanner will accept.
 */
export async function ticketHolderCount(): Promise<number> {
  const { count } = await adminClient()
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .in("status", ["approved", "partial"])
    .not("ticket_code", "is", null);
  return count ?? 0;
}

/**
 * Sum of everything actually collected, in centavos — online and walk-in
 * alike. Sums `amount_paid`, not `amount`, and includes `partial` rows: a
 * partial payment sitting with a staffer is still money in hand and belongs in
 * this total, even though the ticket hasn't been issued yet. `amount_paid`
 * equals `amount` for every `approved` row (online or walk-in), so this
 * reads identically to before for the common case.
 */
export async function totalCollectedCentavos(): Promise<number> {
  try {
    // Paged: a money total that silently stops at row 1000 is wrong with no
    // sign of it, and tomorrow's walk-ins are what push the count past that.
    const rows = await allRows((from, to) =>
      adminClient()
        .from("registrations")
        .select("amount_paid")
        .in("status", ["approved", "partial"])
        .order("id")
        .range(from, to),
    );
    return rows.reduce((sum, row) => sum + (row.amount_paid as number), 0);
  } catch (error) {
    console.error("totalCollectedCentavos failed", error);
    return 0;
  }
}
