import { z } from "zod";
import {
  MAX_TEXT_LENGTH,
  NOT_APPLICABLE,
  QUESTIONS,
  RATING_SCALE,
} from "./questions";

/**
 * One answer per question id. Ratings are numbers, or NOT_APPLICABLE where
 * the question allows it; tick-all answers are the ticked options; skipped
 * free text and optional choices are null.
 */
export type Answers = Record<string, number | string | string[] | null>;

/** Raw form input: one string per field, or every ticked box for tick-all. */
export type RawAnswers = Record<string, string | string[]>;

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

function asString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * Validates one submission against the current question set.
 *
 * Driven by QUESTIONS rather than a hand-written object schema, so changing
 * the questionnaire never leaves the validation behind. Every question is
 * checked before returning, so the form can show every problem at once
 * instead of one per round trip.
 */
export function parseAnswers(raw: RawAnswers): ParseResult {
  const fieldErrors: Record<string, string> = {};
  const answers: Answers = {};

  for (const question of QUESTIONS) {
    if (question.kind === "multi") {
      const ticked = [raw[question.id] ?? []].flat();
      // Anything outside the listed options arrived by hand-crafting the POST.
      if (ticked.some((value) => !question.options.includes(value))) {
        fieldErrors[question.id] = "Tick only the listed options.";
        continue;
      }
      // Stored in the listed order, once each, however the browser sent them.
      answers[question.id] = question.options.filter((option) =>
        ticked.includes(option),
      );
      continue;
    }

    const value = asString(raw[question.id]);

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
      if (question.kind === "choice" && question.optional) {
        answers[question.id] = null;
        continue;
      }
      fieldErrors[question.id] = "Answer this one before submitting.";
      continue;
    }

    if (question.kind === "rating" && question.allowNA && value === NOT_APPLICABLE) {
      answers[question.id] = NOT_APPLICABLE;
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
