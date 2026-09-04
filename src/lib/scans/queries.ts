import "server-only";
import { adminClient } from "@/lib/supabase/admin";
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
 * Every approved ticket, in the minimal shape the scanner caches, with the
 * earliest known "ok" scan time per ticket so a second device can recognize a
 * ticket another device already admitted — as long as both are online.
 */
export async function approvedManifest(): Promise<Manifest> {
  const [registrations, checkIns] = await Promise.all([
    adminClient()
      .from("registrations")
      .select("id, ticket_code, full_name, year_level, section")
      .eq("status", "approved")
      .not("ticket_code", "is", null),
    adminClient()
      .from("scans")
      .select("registration_id, scanned_at")
      .eq("result", "ok")
      .not("registration_id", "is", null),
  ]);

  if (registrations.error) {
    console.error("approvedManifest failed", registrations.error);
    throw new Error("Could not load the ticket manifest.");
  }
  if (checkIns.error) {
    console.error("approvedManifest check-in lookup failed", checkIns.error);
    throw new Error("Could not load the ticket manifest.");
  }

  const earliestCheckIn = new Map<string, string>();
  for (const row of checkIns.data ?? []) {
    const id = row.registration_id as string;
    const at = row.scanned_at as string;
    const existing = earliestCheckIn.get(id);
    if (!existing || at < existing) earliestCheckIn.set(id, at);
  }

  return {
    generatedAt: new Date().toISOString(),
    entries: (registrations.data ?? []).map((row) => ({
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
  const { data, error } = await adminClient()
    .from("scans")
    .select(
      "code_scanned, scanned_at, device_label, result, registration_id, registrations(full_name, year_level, section)",
    )
    .order("scanned_at", { ascending: false });

  if (error) {
    console.error("allScans failed", error);
    return [];
  }

  return (data ?? []).map((row) => {
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

export async function approvedCount(): Promise<number> {
  const { count } = await adminClient()
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");
  return count ?? 0;
}

/** Sum of every approved registration's amount, in centavos — online and walk-in alike. */
export async function totalCollectedCentavos(): Promise<number> {
  const { data, error } = await adminClient()
    .from("registrations")
    .select("amount")
    .eq("status", "approved");

  if (error) {
    console.error("totalCollectedCentavos failed", error);
    return 0;
  }

  return (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
}
