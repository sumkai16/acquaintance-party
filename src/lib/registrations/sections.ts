import { YEAR_LEVELS } from "./schema";

function letterSections(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

/**
 * The school's actual section naming per year level — lettered throughout,
 * a different count each. Used only to build the per-section breakdown on
 * Find a registration; the checkout and walk-in forms still take section as
 * free text, since a student could legitimately type a section this list
 * doesn't anticipate.
 */
export const SECTIONS_BY_YEAR: Record<(typeof YEAR_LEVELS)[number], string[]> = {
  "1st year": letterSections(7),
  "2nd year": letterSections(7),
  "3rd year": letterSections(6),
  "4th year": letterSections(4),
};
