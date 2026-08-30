import { normalizeScannedCode } from "@/lib/tickets/code";
import type { Manifest, ManifestEntry } from "./manifest";

export type { Manifest, ManifestEntry };

export type Resolution =
  | { result: "ok"; entry: ManifestEntry }
  | { result: "duplicate"; entry: ManifestEntry; firstScannedAt: string }
  | { result: "invalid"; code: string };

export function buildIndex(manifest: Manifest): Map<string, ManifestEntry> {
  return new Map(manifest.entries.map((entry) => [entry.code, entry]));
}

/**
 * Decides what happens at the door, with no network and no database.
 *
 * `alreadyScanned` maps a code to the timestamp it was first accepted **on
 * this device**. Cross-device duplicates cannot be caught here — see the
 * spec's §Accepted limitation — and are surfaced on the dashboard instead.
 */
export function resolveScan(
  rawCode: string,
  index: Map<string, ManifestEntry>,
  alreadyScanned: Map<string, string>,
): Resolution {
  const code = normalizeScannedCode(rawCode);
  const entry = index.get(code);

  if (!entry) return { result: "invalid", code };

  const firstScannedAt = alreadyScanned.get(code);
  if (firstScannedAt) return { result: "duplicate", entry, firstScannedAt };

  return { result: "ok", entry };
}
