import type { RaffleEntrant } from "./types";

export type ParsedEntrantRow = {
  fullName: string;
  yearLevel: string | null;
  section: string | null;
};

function cell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  // ExcelJS hands back numbers for anything typed as a number, e.g. a year
  // level entered as a bare "2" — coerce rather than silently drop the row.
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

/**
 * Validates and trims one row from a manual add or an Excel import.
 * Returns null for a row with no usable name, rather than throwing — an
 * import is expected to contain the odd blank row.
 */
export function normalizeImportRow(cells: {
  fullName?: unknown;
  yearLevel?: unknown;
  section?: unknown;
}): ParsedEntrantRow | null {
  const fullName = cell(cells.fullName);
  if (!fullName || fullName.length < 2 || fullName.length > 120) return null;

  return {
    fullName,
    yearLevel: cell(cells.yearLevel),
    section: cell(cells.section),
  };
}

/**
 * Finds an existing entrant whose name matches, case- and
 * whitespace-insensitively — against either the scanned-in pool or an
 * already-added extra entrant.
 *
 * Names collide legitimately, so this is a warning, never a block — see the
 * caller in entrant-actions.ts.
 */
export function findNameCollision(
  pool: readonly RaffleEntrant[],
  fullName: string,
): RaffleEntrant | null {
  const target = fullName.trim().toLowerCase();
  return (
    pool.find((entrant) => entrant.fullName.trim().toLowerCase() === target) ??
    null
  );
}
