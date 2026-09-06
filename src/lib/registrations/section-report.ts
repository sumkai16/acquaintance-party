import { YEAR_LEVELS } from "./schema";
import { SECTIONS_BY_YEAR } from "./sections";

export type SectionSummary = { section: string; count: number; totalCentavos: number };
export type YearSectionReport = { yearLevel: string; sections: SectionSummary[] };

type RegistrationLike = { year_level: string; section: string; amount: number };

function normalizeSection(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Groups approved registrations into a per-year, per-section payee count
 * and amount total. Every canonical section for a year appears even at
 * zero — an empty section is meaningful to an admin scanning for gaps, not
 * something to hide. A section that doesn't match the canonical list (a
 * typo, a different naming scheme someone used) lands under "Other" rather
 * than being silently dropped, so this always reconciles with the page's
 * overall Total payees/Total amount cards.
 */
export function buildSectionReport(registrations: RegistrationLike[]): YearSectionReport[] {
  return YEAR_LEVELS.map((yearLevel) => {
    const canonicalSections = SECTIONS_BY_YEAR[yearLevel];
    const bySection = new Map<string, SectionSummary>();
    for (const section of canonicalSections) {
      bySection.set(section, { section, count: 0, totalCentavos: 0 });
    }

    let otherCount = 0;
    let otherTotal = 0;

    for (const registration of registrations) {
      if (registration.year_level !== yearLevel) continue;
      const key = normalizeSection(registration.section);
      const existing = bySection.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalCentavos += registration.amount;
      } else {
        otherCount += 1;
        otherTotal += registration.amount;
      }
    }

    const sections = canonicalSections.map((section) => bySection.get(section)!);
    if (otherCount > 0) {
      sections.push({ section: "Other", count: otherCount, totalCentavos: otherTotal });
    }

    return { yearLevel, sections };
  });
}
