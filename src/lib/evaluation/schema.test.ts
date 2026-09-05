import { describe, expect, it } from "vitest";
import { parseAnswers } from "./schema";
import { MAX_TEXT_LENGTH, QUESTIONS } from "./questions";

/** A complete, valid submission built from whatever the current draft asks. */
function complete(over: Record<string, string> = {}): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const question of QUESTIONS) {
    answers[question.id] =
      question.kind === "rating"
        ? "4"
        : question.kind === "choice"
          ? question.options[0]
          : "It was good.";
  }
  return { ...answers, ...over };
}

const ratingId = QUESTIONS.find((q) => q.kind === "rating")!.id;
const choice = QUESTIONS.find((q) => q.kind === "choice")!;
const textId = QUESTIONS.find((q) => q.kind === "text")!.id;

describe("parseAnswers", () => {
  it("accepts a complete submission and keeps ratings numeric", () => {
    const result = parseAnswers(complete());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers[ratingId]).toBe(4);
    expect(result.answers[choice.id]).toBe(choice.options[0]);
  });

  it("reports every missed question at once, not just the first", () => {
    // The form shows all of these together — one error per round trip would
    // walk a student through the questionnaire one refusal at a time.
    const result = parseAnswers({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const required = QUESTIONS.filter((q) => q.kind !== "text");
    expect(Object.keys(result.fieldErrors).sort()).toEqual(
      required.map((q) => q.id).sort(),
    );
  });

  it("treats free text as optional and stores a blank as null", () => {
    const result = parseAnswers(complete({ [textId]: "   " }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers[textId]).toBeNull();
  });

  it("trims free text rather than storing the padding", () => {
    const result = parseAnswers(complete({ [textId]: "  the food  " }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers[textId]).toBe("the food");
  });

  it("rejects free text past the length cap", () => {
    const result = parseAnswers(
      complete({ [textId]: "x".repeat(MAX_TEXT_LENGTH + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors[textId]).toBeDefined();
  });

  it("rejects a rating outside the scale", () => {
    for (const bad of ["0", "6", "3.5", "not a number"]) {
      const result = parseAnswers(complete({ [ratingId]: bad }));
      expect(result.ok, `${bad} should be rejected`).toBe(false);
    }
  });

  it("rejects a choice that isn't one of the options", () => {
    // The form only offers the listed options, so anything else arrived by
    // hand-crafting the POST.
    const result = parseAnswers(complete({ [choice.id]: "something else" }));
    expect(result.ok).toBe(false);
  });

  it("ignores fields that aren't questions", () => {
    const result = parseAnswers(complete({ smuggled: "value" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers).not.toHaveProperty("smuggled");
  });
});
