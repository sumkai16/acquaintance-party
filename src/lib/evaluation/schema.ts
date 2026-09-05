import { z } from "zod";
import { MAX_TEXT_LENGTH, QUESTIONS, RATING_SCALE } from "./questions";

/** One answer per question id. Free text is null when it was left blank. */
export type Answers = Record<string, number | string | null>;

export type ParseResult =
  | { ok: true; answers: Answers }
  | { ok: false; fieldErrors: Record<string, string> };

const ratingField = z.coerce
  .number()
  .refine(
    (value) => (RATING_SCALE as readonly number[]).includes(value),
    "Choose a rating from 1 to 5.",
  );

const textField = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .max(MAX_TEXT_LENGTH, `Keep this under ${MAX_TEXT_LENGTH} characters.`),
  );

function choiceField(options: readonly string[]) {
  return z
    .string()
    .refine((value) => options.includes(value), "Choose one of the options.");
}

/**
 * Validates one submission against the current question set.
 *
 * Driven by QUESTIONS rather than a hand-written object schema, so changing
 * the draft questionnaire never leaves the validation behind. Every question
 * is checked before returning, so the form can show every problem at once
 * instead of one per round trip.
 */
export function parseAnswers(raw: Record<string, string>): ParseResult {
  const fieldErrors: Record<string, string> = {};
  const answers: Answers = {};

  for (const question of QUESTIONS) {
    const value = raw[question.id] ?? "";

    if (question.kind === "text") {
      const parsed = textField.safeParse(value);
      if (!parsed.success) {
        fieldErrors[question.id] = parsed.error.issues[0].message;
        continue;
      }
      // Blank free text is stored as null, not "", so the admin summary can
      // tell "skipped this" apart from "answered with nothing".
      answers[question.id] = parsed.data === "" ? null : parsed.data;
      continue;
    }

    if (value === "") {
      fieldErrors[question.id] = "Answer this one before submitting.";
      continue;
    }

    const field =
      question.kind === "rating" ? ratingField : choiceField(question.options);
    const parsed = field.safeParse(value);
    if (!parsed.success) {
      fieldErrors[question.id] = parsed.error.issues[0].message;
      continue;
    }
    answers[question.id] = parsed.data;
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, answers };
}
