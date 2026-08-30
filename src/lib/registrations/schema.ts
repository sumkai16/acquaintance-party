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

export const checkoutSchema = z.object({
  fullName: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(2, "Enter your full name.")
        .max(120, "That name is too long."),
    ),

  yearLevel: z.enum(YEAR_LEVELS, { error: "Choose your year level." }),

  section: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, "Enter your section.")
        .max(40, "That section is too long."),
    ),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),

  gcashReference: z
    .string()
    .refine(isValidGcashReference, "The GCash reference number is 13 digits.")
    .transform(normalizeGcashReference),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
