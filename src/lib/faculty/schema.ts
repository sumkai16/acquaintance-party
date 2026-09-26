import { z } from "zod";

/**
 * The /invitation entry form. Deliberately tiny: a name and the tick that
 * says they read the letter.
 *
 * No department field — it used to be optional and most people skipped it, and
 * every extra field is a reason for an older reader to stop. The
 * `faculty_invitations.department` column stays for the entries that already
 * have one; nothing writes it any more.
 *
 * No email field. The QR is shared rather than per-person, so there is no
 * address to verify against and nothing the app would send back — collecting
 * one on a public form would gather junk it never uses.
 */
const fullName = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(120, "That name is too long.");

export const facultyEntrySchema = z.object({
  fullName,
  // A literal, not a boolean: the form must not submit without the tick, and
  // this is what says so rather than a check in the action.
  acknowledged: z.literal(true, {
    error: "Please confirm you have read the invitation.",
  }),
});

export type FacultyEntry = z.infer<typeof facultyEntrySchema>;
