import type { ScanResult } from "@/lib/supabase/types";

export type ScanRecord = {
  registrationId: string | null;
  fullName: string | null;
  yearLevel: string | null;
  section: string | null;
  codeScanned: string;
  scannedAt: string;
  deviceLabel: string;
  result: ScanResult;
};

export type Summary = {
  checkedIn: number;
  notYetArrived: number;
  totalScans: number;
  invalid: number;
};

export type DoubleScan = {
  registrationId: string;
  fullName: string | null;
  devices: string[];
};

export function summarize(rows: ScanRecord[], ticketsSold: number): Summary {
  const admitted = new Set(
    rows
      .filter((row) => row.result === "ok" && row.registrationId)
      .map((row) => row.registrationId as string),
  );

  return {
    checkedIn: admitted.size,
    notYetArrived: Math.max(0, ticketsSold - admitted.size),
    totalScans: rows.length,
    invalid: rows.filter((row) => row.result === "invalid").length,
  };
}

/**
 * One ticket admitted by two different devices.
 *
 * This is the after-the-fact half of the accepted offline limitation: during a
 * blackout two phones cannot coordinate, so the same ticket can pass at two
 * lanes. A `duplicate` result is *not* a double scan — that is the scanner
 * working correctly and turning someone away.
 */
export function findDoubleScans(rows: ScanRecord[]): DoubleScan[] {
  const byRegistration = new Map<string, ScanRecord[]>();

  for (const row of rows) {
    if (row.result !== "ok" || !row.registrationId) continue;
    const existing = byRegistration.get(row.registrationId);
    if (existing) existing.push(row);
    else byRegistration.set(row.registrationId, [row]);
  }

  const found: DoubleScan[] = [];
  for (const [registrationId, scans] of byRegistration) {
    const devices = [...new Set(scans.map((scan) => scan.deviceLabel))].sort();
    if (devices.length > 1) {
      found.push({ registrationId, fullName: scans[0].fullName, devices });
    }
  }
  return found;
}

export function filterScans(
  rows: ScanRecord[],
  filter: { year?: string; section?: string },
): ScanRecord[] {
  const year = filter.year?.trim();
  const section = filter.section?.trim();

  return rows.filter((row) => {
    if (year && row.yearLevel !== year) return false;
    if (section && row.section !== section) return false;
    return true;
  });
}

export type SortColumn = "time" | "name" | "result" | "door";

function sortKey(row: ScanRecord, column: SortColumn): string {
  switch (column) {
    case "time":
      return row.scannedAt;
    case "name":
      // A missing name sorts after every real one, in either direction —
      // an unmatched scan is the exception, not something to bury real
      // names under when sorting descending.
      return row.fullName ?? "￿";
    case "result":
      return row.result;
    case "door":
      return row.deviceLabel;
  }
}

/** Dashboard-table sort. Pure — the page just renders whatever order this returns. */
export function sortScans(
  rows: ScanRecord[],
  column: SortColumn,
  direction: "asc" | "desc",
): ScanRecord[] {
  const sorted = [...rows].sort((a, b) =>
    sortKey(a, column).localeCompare(sortKey(b, column)),
  );
  return direction === "asc" ? sorted : sorted.reverse();
}
