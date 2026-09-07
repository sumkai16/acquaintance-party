export const YEAR_LEVELS = [
  "1st year",
  "2nd year",
  "3rd year",
  "4th year",
] as const;

export type YearLevel = (typeof YEAR_LEVELS)[number];

function letterSections(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

/**
 * The school's actual section naming per year level — lettered throughout,
 * a different count each. This is the authoritative list: checkout, the
 * walk-in form, and the Excel bulk import all reject a section that isn't
 * on it, so every section written from here on is one of these strings.
 *
 * Rows that predate that rule can still hold anything; the per-section
 * breakdown's "Other" bucket is where they land — see section-report.ts.
 *
 * YEAR_LEVELS lives here rather than in schema.ts so that schema.ts can
 * import this list to validate against without a circular import; schema.ts
 * re-exports it for the many callers that already import it from there.
 */
export const SECTIONS_BY_YEAR: Record<YearLevel, string[]> = {
  "1st year": letterSections(7),
  "2nd year": letterSections(7),
  "3rd year": letterSections(6),
  "4th year": letterSections(4),
};

/**
 * The sections a given year level offers — empty for an unrecognised or
 * not-yet-chosen year, which is what leaves the Section dropdown disabled
 * until a year level is picked.
 */
export function sectionsFor(yearLevel: string): readonly string[] {
  return SECTIONS_BY_YEAR[yearLevel as YearLevel] ?? [];
}

/** `" b "` and `"B"` are the same section. Applied on input and on report. */
export function normalizeSection(value: string): string {
  return value.trim().toUpperCase();
}
