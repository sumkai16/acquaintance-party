import { z } from "zod";

/**
 * The /invitation entry form. Deliberately tiny: a name, an optional
 * department, and the tick that says they read the letter.
 *
 * No email field. The QR is shared rather than per-person, so there is no
 * address to verify against and nothing the app would send back — collecting
 * one on a public form would gather junk it never uses.
 */
export const MAX_DEPARTMENT_LENGTH = 80;

const fullName = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(120, "That name is too long.");

/**
 * Empty becomes null rather than "" — the column is nullable, and a blank
 * string would render as an empty line on the adviser's list instead of
 * being left out.
 */
const department = z
  .string()
  .trim()
  .max(MAX_DEPARTMENT_LENGTH, "That department name is too long.")
  .transform((value) => (value === "" ? null : value));

export const facultyEntrySchema = z.object({
  fullName,
  department,
  // A literal, not a boolean: the form must not submit without the tick, and
  // this is what says so rather than a check in the action.
  acknowledged: z.literal(true, {
    error: "Please confirm you have read the invitation.",
  }),
});

export type FacultyEntry = z.infer<typeof facultyEntrySchema>;
