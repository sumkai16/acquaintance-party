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

// The actual identity key behind the one-registration-per-student cap —
// email alone isn't reliable, since a student can just use a new address
// per submission.
const studentId = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, "Enter your student ID.")
      .max(30, "That student ID is too long."),
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
