/**
 * The post-event evaluation, in one place.
 *
 * DRAFT. The wording below stands in until the organisers hand over the real
 * questionnaire — editing this file is the whole change, since the form, the
 * validation schema, and the admin summary are all generated from it. Bump
 * FORM_VERSION when the questions change so responses already in the database
 * stay readable against the wording that produced them.
 */
export const FORM_VERSION = "draft-1";

export const RATING_SCALE = [1, 2, 3, 4, 5] as const;

export type RatingQuestion = {
  kind: "rating";
  id: string;
  prompt: string;
  lowLabel: string;
  highLabel: string;
};

export type ChoiceQuestion = {
  kind: "choice";
  id: string;
  prompt: string;
  options: readonly string[];
};

export type TextQuestion = {
  kind: "text";
  id: string;
  prompt: string;
  /** Free text is always optional — nobody should be forced to write prose. */
  placeholder: string;
};

export type Question = RatingQuestion | ChoiceQuestion | TextQuestion;

export const MAX_TEXT_LENGTH = 500;

export const QUESTIONS: readonly Question[] = [
  {
    kind: "rating",
    id: "overall",
    prompt: "How was the party overall?",
    lowLabel: "Not great",
    highLabel: "Loved it",
  },
  {
    kind: "rating",
    id: "venue",
    prompt: "The venue — space, seating, and sound",
    lowLabel: "Poor",
    highLabel: "Excellent",
  },
  {
    kind: "rating",
    id: "food",
    prompt: "Food and drinks",
    lowLabel: "Poor",
    highLabel: "Excellent",
  },
  {
    kind: "rating",
    id: "program",
    prompt: "The program and the hosts",
    lowLabel: "Poor",
    highLabel: "Excellent",
  },
  {
    kind: "rating",
    id: "entry",
    prompt: "Signing up and getting in at the door",
    lowLabel: "Painful",
    highLabel: "Smooth",
  },
  {
    kind: "choice",
    id: "heard_from",
    prompt: "How did you first hear about the party?",
    options: [
      "A classmate or friend",
      "Facebook",
      "An org officer",
      "A poster on campus",
      "Somewhere else",
    ],
  },
  {
    kind: "choice",
    id: "attend_again",
    prompt: "Would you come to the next one?",
    options: ["Yes", "Maybe", "No"],
  },
  {
    kind: "text",
    id: "best_part",
    prompt: "What was the best part?",
    placeholder: "Optional",
  },
  {
    kind: "text",
    id: "improve",
    prompt: "What should we do differently next time?",
    placeholder: "Optional",
  },
] as const;

export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((question) => question.id === id);
}
