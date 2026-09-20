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
 * SCC, the two-digit entry year, then a serial of any length.
 *
 * Checked against the live table before this was first tightened: 17 of
 * the 18 registrations taken so far matched SCC-YY + 8 digits exactly, and
 * the eighteenth was a typo — `SCC-00025420`, missing the year segment
 * entirely, entered by a staff member and approved before anyone noticed.
 * A malformed ID is worse than an ugly one: `student_id` is the key behind
 * the one-registration-per-student cap, so a mistyped one neither collides
 * with the student's real ID nor reserves it.
 *
 * The serial itself isn't length-checked: real submissions kept showing new
 * lengths (6, 7, 8 digits across entry years), so the school's serials
 * aren't a fixed width and the check only needs to catch the shape — the
 * SCC prefix and the year segment — not the digit count.
 *
 * Anchored, and applied after normalizeStudentId, so it sees the trimmed
 * uppercase form rather than whatever spacing or case was typed.
 */
export const STUDENT_ID_PATTERN = /^SCC-\d{2}-\d+$/;

/** The same shape for an <input pattern>, which has its own anchoring and
 * is matched against the raw value — hence the case-insensitive prefix,
 * since the field only *looks* uppercase (a CSS transform). */
export const STUDENT_ID_INPUT_PATTERN = "[Ss][Cc][Cc]-[0-9]{2}-[0-9]+";

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
        "Student ID looks like SCC-24-0012345 — SCC, your two-digit entry year, then your serial.",
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

// The big free providers a mistyped domain is almost always aiming for.
const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
];

// Real providers that sit within two edits of one above — "ymail.com" is one
// letter from "gmail.com" but is its own service, so it must not be flagged.
const KNOWN_LOOKALIKE_DOMAINS = [
  "ymail.com",
  "email.com",
  "mail.com",
  "live.com",
  "msn.com",
];

// Providers that only exist at one address. Anything else starting with the
// name ("gmail.ph", "gmail.com.ph", "gmail.org") is a mistake. Yahoo, Outlook
// and Hotmail are left out on purpose: they run real regional domains
// (yahoo.com.ph, outlook.ph, hotmail.co.uk) that this would wrongly reject.
const SINGLE_DOMAIN_PROVIDERS = ["gmail.com", "icloud.com"];

function levenshteinDistance(a: string, b: string): number {
  const dist: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dist[i][0] = i;
  for (let j = 0; j <= b.length; j++) dist[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dist[i][j] = Math.min(
        dist[i - 1][j] + 1,
        dist[i][j - 1] + 1,
        dist[i - 1][j - 1] + cost,
      );
    }
  }
  return dist[a.length][b.length];
}

/**
 * A domain like "gamil.com" is still shaped like an email, so Resend
 * accepts the send and we stamp it delivered — the ticket just never
 * arrives, and nothing else ever flags the typo. Catches a near-miss of a
 * major provider (edit distance ≤2), or a right name with a wrong ending on
 * a provider that only has one address, before the registration is saved.
 */
function suggestedDomainFor(domain: string): string | null {
  if (COMMON_EMAIL_DOMAINS.includes(domain)) return null;
  if (KNOWN_LOOKALIKE_DOMAINS.includes(domain)) return null;

  for (const single of SINGLE_DOMAIN_PROVIDERS) {
    const name = single.split(".")[0];
    if (domain.startsWith(`${name}.`)) return single;
  }

  for (const known of COMMON_EMAIL_DOMAINS) {
    if (
      Math.abs(domain.length - known.length) <= 2 &&
      levenshteinDistance(domain, known) <= 2
    ) {
      return known;
    }
  }
  return null;
}

/**
 * The corrected address when the domain looks like a mistyped major provider
 * (`juan@gmial.com` -> `juan@gmail.com`), otherwise null. Exported so a form
 * can offer it as a one-tap fix instead of making staff retype the address.
 */
export function suggestEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 1) return null;
  const suggestion = suggestedDomainFor(normalized.slice(at + 1));
  return suggestion ? `${normalized.slice(0, at)}@${suggestion}` : null;
}

/**
 * Zod's own email pattern with letters like ñ allowed before the @ — students
 * type their names, and the stock check rejects any non-ASCII letter. The
 * domain part stays strict so "a@b" still fails.
 */
const EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)([\p{L}\p{M}0-9_'+\-.]*)[\p{L}\p{M}0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/u;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ pattern: EMAIL_PATTERN, error: "Enter a valid email address." }))
  .superRefine((value, ctx) => {
    const suggestion = suggestEmail(value);
    if (suggestion) {
      ctx.addIssue({
        code: "custom",
        message: `Check the email — did you mean "${suggestion}"?`,
      });
    }
  });

/**
 * What is wrong with an email as typed, or null when it is fine or still
 * empty — the same rules the server applies, so a form can show the problem
 * as someone types instead of after a failed submit. `fix` is the corrected
 * address when the domain looks like a mistyped provider.
 */
export function emailProblem(value: string): { message: string; fix: string | null } | null {
  if (value.trim() === "") return null;
  const result = email.safeParse(value);
  if (result.success) return null;
  return {
    message: result.error.issues[0]?.message ?? "Enter a valid email address.",
    fix: suggestEmail(value),
  };
}

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
