/** One typed row of the Walk-in list, as it is kept between visits. */
export type DraftRow = {
  id: string;
  fullName: string;
  studentId: string;
  yearLevel: string;
  section: string;
  email: string;
};

/** A saved list and when it was last saved (ISO timestamp). */
export type WalkInDraft = { rows: DraftRow[]; updatedAt: string };

/** Same cap as the Excel import — a sheet longer than this is split anyway. */
export const MAX_DRAFT_ROWS = 200;

// Generous ceilings, not validation: the schema judges the content when the
// rows are approved. These only stop a client from parking megabytes here.
const MAX_LENGTH: Record<Exclude<keyof DraftRow, "id">, number> = {
  fullName: 120,
  studentId: 40,
  yearLevel: 20,
  section: 10,
  email: 254,
};

/**
 * What the server is willing to store for a draft. The rows come from the
 * browser, so nothing about them is trusted: anything that isn't an array is
 * dropped, extra keys are stripped, every value is cut to a sane length, and
 * a row with nothing typed in it isn't kept.
 */
export function sanitizeDraftRows(input: unknown): DraftRow[] {
  if (!Array.isArray(input)) return [];

  const rows: DraftRow[] = [];
  for (const item of input.slice(0, MAX_DRAFT_ROWS)) {
    if (typeof item !== "object" || item === null) continue;
    const source = item as Record<string, unknown>;

    const text = (key: keyof typeof MAX_LENGTH): string =>
      typeof source[key] === "string" ? (source[key] as string).slice(0, MAX_LENGTH[key]) : "";

    const row: DraftRow = {
      id: typeof source.id === "string" ? source.id.slice(0, 64) : "",
      fullName: text("fullName"),
      studentId: text("studentId"),
      yearLevel: text("yearLevel"),
      section: text("section"),
      email: text("email"),
    };
    if (!row.fullName.trim() && !row.studentId.trim() && !row.email.trim()) continue;
    rows.push(row);
  }
  return rows;
}
