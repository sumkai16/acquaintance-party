import type { ScanResult } from "@/lib/supabase/types";

/** The header row the Sheet is set up with. Order is the contract. */
export const SHEET_HEADERS = [
  "Scanned at (device)",
  "Synced at (server)",
  "Name",
  "Year level",
  "Section",
  "Ticket code",
  "Door",
  "Result",
] as const;

export type SheetScan = {
  codeScanned: string;
  scannedAt: string;
  syncedAt: string;
  deviceLabel: string;
  result: ScanResult;
  fullName: string | null;
  yearLevel: string | null;
  section: string | null;
};

const manilaParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * "2026-10-05 16:04:12", always in Manila time.
 *
 * Pinned to the venue's timezone rather than the server's: Vercel runs in
 * UTC, and a sheet of UTC timestamps is unreadable to the people watching it
 * fill in during the party.
 */
function manilaTime(iso: string): string {
  const parts = new Map(
    manilaParts.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );

  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")} ${parts.get("hour")}:${parts.get("minute")}:${parts.get("second")}`;
}

/**
 * One scan as a row of cells.
 *
 * Both clocks go in on purpose. `scannedAt` is the phone's, which may be
 * minutes out; `syncedAt` is the server's. A row showing only one hides how
 * long a device was offline.
 */
export function sheetRow(scan: SheetScan): string[] {
  return [
    manilaTime(scan.scannedAt),
    manilaTime(scan.syncedAt),
    scan.fullName ?? "",
    scan.yearLevel ?? "",
    scan.section ?? "",
    scan.codeScanned,
    scan.deviceLabel,
    scan.result,
  ];
}
