import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { Manifest } from "./manifest";
import type { ScanResult } from "@/lib/supabase/types";

export type ScanRow = {
  id: string;
  registrationId: string | null;
  codeScanned: string;
  scannedAt: string;
  deviceLabel: string;
  result: ScanResult;
};

/** Every approved ticket, in the minimal shape the scanner caches. */
export async function approvedManifest(): Promise<Manifest> {
  const { data, error } = await adminClient()
    .from("registrations")
    .select("id, ticket_code, full_name, year_level, section")
    .eq("status", "approved")
    .not("ticket_code", "is", null);

  if (error) {
    console.error("approvedManifest failed", error);
    throw new Error("Could not load the ticket manifest.");
  }

  return {
    generatedAt: new Date().toISOString(),
    entries: (data ?? []).map((row) => ({
      code: row.ticket_code as string,
      registrationId: row.id as string,
      fullName: row.full_name as string,
      yearLevel: row.year_level as string,
      section: row.section as string,
    })),
  };
}

/**
 * Inserts a batch of queued scans.
 *
 * The client generates each `id`, so a retried batch upserts onto the same
 * rows instead of double-counting attendance. `ignoreDuplicates` means a
 * re-sync is a no-op rather than an error — the scanner retries blindly on an
 * interval and must never be punished for it.
 */
export async function recordScans(
  rows: ScanRow[],
): Promise<{ ok: true; accepted: number } | { ok: false; error: string }> {
  if (rows.length === 0) return { ok: true, accepted: 0 };

  const { error } = await adminClient()
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
    );

  if (error) {
    console.error("recordScans failed", error);
    return { ok: false, error: "Could not save scans." };
  }

  return { ok: true, accepted: rows.length };
}
