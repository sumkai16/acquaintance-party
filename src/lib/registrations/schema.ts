import { z } from "zod";
import {
  isValidGcashReference,
  normalizeGcashReference,
} from "@/lib/tickets/reference";

export const YEAR_LEVELS = [
  "1st year",
  "2nd year",
  "3rd year",
  "4th year",
] as const;

const fullName = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "Enter your full name.")
      .max(120, "That name is too long."),
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
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, "Enter your section.")
      .max(40, "That section is too long."),
  );

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
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// A walk-in cash sale an admin enters directly — same identity fields as
// checkout, minus the GCash reference there's nothing to verify.
export const walkInSchema = z.object({
  fullName,
  studentId,
  yearLevel,
  section,
  email,
});

export type WalkInInput = z.infer<typeof walkInSchema>;
