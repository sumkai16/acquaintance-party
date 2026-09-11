import { z } from "zod";
import {
  isValidGcashReference,
  normalizeGcashReference,
} from "@/lib/tickets/reference";
import {
  normalizeSection,
  sectionsFor,
  YEAR_LEVELS,
} from "./sections";

// Re-exported so the forms, the report, and the Excel import can keep
// importing it from here; it lives in ./sections next to the section list
// it pairs with — see the comment on SECTIONS_BY_YEAR.
export { YEAR_LEVELS };

const fullName = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "Enter your full name.")
      // 60, not an arbitrary 120: this is the name printed on the
      // certificate, and below roughly this length fitFontSize() stops being
      // able to keep it on one line at a readable size. Every real name
      // clears it comfortably.
      .max(60, "That name is too long."),
  );

/**
 * Uppercased, not just trimmed, and that isn't cosmetic: `student_id` is
 * matched exactly by `registrations_student_id_active_key`, so
 * `scc-25-00025380` and `SCC-25-00025380` would sit in the index as two
 * different students and both get a ticket. Every ID issued by the school
 * is uppercase anyway, so folding case only ever closes that hole.
 *
 * The forms also render the field in uppercase (a CSS transform, so the
 * caret never jumps mid-word), which makes what a student sees while typing
 * match what actually gets stored.
 */
export function normalizeStudentId(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * SCC, the two-digit entry year, then an eight-digit serial.
 *
 * Checked against the live table before this was tightened: 17 of the 18
 * registrations taken so far matched this exactly, and the eighteenth was
 * the typo that prompted it — `SCC-00025420`, missing the year segment
 * entirely, entered by a staff member and approved before anyone noticed.
 * A malformed ID is worse than an ugly one: `student_id` is the key behind
 * the one-registration-per-student cap, so a mistyped one neither collides
 * with the student's real ID nor reserves it.
 *
 * Anchored, and applied after normalizeStudentId, so it sees the trimmed
 * uppercase form rather than whatever spacing or case was typed.
 */
export const STUDENT_ID_PATTERN = /^SCC-\d{2}-\d{8}$/;

/** The same shape for an <input pattern>, which has its own anchoring and
 * is matched against the raw value — hence the case-insensitive prefix,
 * since the field only *looks* uppercase (a CSS transform). */
export const STUDENT_ID_INPUT_PATTERN = "[Ss][Cc][Cc]-[0-9]{2}-[0-9]{8}";

/** What both forms show, and what the import template seeds. */
export const STUDENT_ID_PLACEHOLDER = "SCC-00-00000000";

// The actual identity key behind the one-registration-per-student cap —
// email alone isn't reliable, since a student can just use a new address
// per submission.
const studentId = z
  .string()
  .transform(normalizeStudentId)
  .pipe(
    z
      .string()
      .min(1, "Enter your student ID.")
      .regex(
        STUDENT_ID_PATTERN,
        "Student ID looks like SCC-24-00012345 — SCC, your two-digit entry year, then eight digits.",
      ),
  );

const yearLevel = z.enum(YEAR_LEVELS, { error: "Choose your year level." });

const section = z
  .string()
  .transform(normalizeSection)
  .pipe(z.string().min(1, "Choose your section."));

// Section is only meaningful against a year level — 4th year stops at D
// while 1st year runs to G — so the pair is checked here rather than on the
// field. `path: ["section"]` puts the message under the Section dropdown:
// both server actions key fieldErrors off issue.path[0]. Zod runs an
// object-level check only once every field passed, so a missing year level
// still reports "Choose your year level." instead of this.
function checkSectionMatchesYear(
  data: { yearLevel: string; section: string },
  ctx: z.RefinementCtx,
) {
  if (sectionsFor(data.yearLevel).includes(data.section)) return;
  ctx.addIssue({
    code: "custom",
    path: ["section"],
    message: `${data.yearLevel} has no section ${data.section}.`,
  });
}

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const checkoutSchema = z.object({
  fullName,
  studentId,
  yearLevel,
  section,
  email,

  gcashReference: z
    .string()
    .refine(isValidGcashReference, "The GCash reference number is 13 digits.")
    .transform(normalizeGcashReference),
}).superRefine(checkSectionMatchesYear);

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// A walk-in cash sale an admin enters directly — same identity fields as
// checkout, minus the GCash reference there's nothing to verify.
export const walkInSchema = z.object({
  fullName,
  studentId,
  yearLevel,
  section,
  email,
}).superRefine(checkSectionMatchesYear);

export type WalkInInput = z.infer<typeof walkInSchema>;
