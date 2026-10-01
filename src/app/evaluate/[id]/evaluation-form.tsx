"use client";

import { useActionState, useRef, useState } from "react";
import {
  MAX_TEXT_LENGTH,
  NOT_APPLICABLE,
  RATING_LABELS,
  RATING_SCALE,
  SECTIONS,
  type Question,
} from "@/lib/evaluation/questions";
import { submitEvaluation, type FormState } from "./actions";

const initial: FormState = { status: "idle", attempt: 0 };

// Ratings and choices must be answered; written answers and tick-all lists are
// optional, same as parseAnswers() on the server.
const isRequired = (question: Question) =>
  question.kind === "rating" || question.kind === "choice";

const LAST_STEP = SECTIONS.length - 1;

export function EvaluationForm({ registrationId }: { registrationId: string }) {
  const action = submitEvaluation.bind(null, registrationId);
  const [state, formAction, pending] = useActionState(action, initial);
  const values = state.values ?? {};

  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [seenAttempt, setSeenAttempt] = useState(state.attempt);

  // A rejected submit comes back with every miss at once. Take those into the
  // page's own error state and jump to the first section that has one, rather
  // than leaving the student on the last page with a count and nothing to see.
  if (state.attempt !== seenAttempt) {
    setSeenAttempt(state.attempt);
    const fieldErrors = state.fieldErrors ?? {};
    setErrors(fieldErrors);
    const first = SECTIONS.findIndex((section) =>
      section.questions.some((question) => fieldErrors[question.id]),
    );
    if (first >= 0) setStep(first);
  }

  // See the comment on FormState.values in actions.ts — remounting on the
  // attempt number is what keeps answered questions answered after an error.
  const keyed = (id: string) => `${id}-${state.attempt}`;
  const missed = Object.keys(errors).length;

  function goTo(next: number) {
    setStep(next);
    // To the progress bar, not the page top — the intro and "Answering as"
    // card above the form would otherwise be scrolled past on every page.
    formRef.current?.scrollIntoView({ block: "start" });
  }

  function next() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const unanswered: Record<string, string> = {};
    for (const question of SECTIONS[step].questions) {
      if (isRequired(question) && !data.get(question.id)) {
        unanswered[question.id] = "Answer this one before going on.";
      }
    }
    if (Object.keys(unanswered).length > 0) {
      setErrors((current) => ({ ...current, ...unanswered }));
      return;
    }
    goTo(step + 1);
  }

  const section = SECTIONS[step];
  const hasRating = section.questions.some((q) => q.kind === "rating");

  return (
    // noValidate for the same reason as checkout-form.tsx: parseAnswers
    // reports every missed question in one pass, which the browser's own
    // one-at-a-time validation would pre-empt.
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="flex flex-col gap-8"
      onChange={(event) => {
        // Answering a question clears its own error.
        const { name } = event.target as unknown as { name?: string };
        if (name && errors[name]) {
          setErrors((current) => {
            const rest = { ...current };
            delete rest[name];
            return rest;
          });
        }
      }}
      onSubmit={(event) => {
        // Enter on an earlier page should step forward, never send.
        if (step < LAST_STEP) {
          event.preventDefault();
          next();
        }
      }}
    >
      <div className="flex flex-col gap-2" aria-live="polite">
        <p className="text-xs uppercase tracking-[0.2em] text-ink/60">
          Step {step + 1} of {SECTIONS.length}
        </p>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-ink/10"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={SECTIONS.length}
          aria-valuenow={step + 1}
          aria-label="Evaluation progress"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${((step + 1) / SECTIONS.length) * 100}%` }}
          />
        </div>
      </div>

      {state.message && missed > 0 ? (
        <p
          role="alert"
          className="rounded border border-accent/30 bg-accent/10 px-4 py-3 text-accent"
        >
          {state.message} {missed} still need an answer.
        </p>
      ) : state.message ? (
        <p
          role="alert"
          className="rounded border border-accent/30 bg-accent/10 px-4 py-3 text-accent"
        >
          {state.message}
        </p>
      ) : null}

      {hasRating ? (
        <div className="rounded border border-ink/15 bg-white/60 px-4 py-3 text-sm text-ink/70">
          <p className="font-semibold text-ink">Rating scale</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {[...RATING_SCALE].reverse().map((point) => (
              <li key={point}>
                <span className="font-semibold tabular-nums">{point}</span>{" "}
                {RATING_LABELS[point]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Every section stays mounted and only the current one is shown, so all
          answers go up in the one submit and submitEvaluation is unchanged. */}
      {SECTIONS.map((s, index) => (
        <section
          key={s.id}
          className={index === step ? "flex flex-col gap-7" : "hidden"}
        >
          <h2 className="border-b border-ink/15 pb-2 font-display text-2xl uppercase text-accent">
            {s.title}
          </h2>
          {s.questions.map((question) => (
            <fieldset key={keyed(question.id)} className="flex flex-col gap-3">
              <legend className="font-semibold">{question.prompt}</legend>
              <QuestionField
                question={question}
                defaultValue={values[question.id] ?? ""}
              />
              {errors[question.id] ? (
                <p className="text-sm font-medium text-accent">
                  {errors[question.id]}
                </p>
              ) : null}
            </fieldset>
          ))}
        </section>
      ))}

      <div className="flex gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            className="rounded-full border border-ink/25 px-6 py-3.5 font-semibold uppercase tracking-wide transition-colors hover:bg-ink/5 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
          >
            Back
          </button>
        ) : null}
        {step < LAST_STEP ? (
          <button
            type="button"
            onClick={next}
            className="flex-1 rounded-full bg-accent px-6 py-3.5 font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
          >
            Next
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-full bg-accent px-6 py-3.5 font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
          >
            {pending ? "Sending…" : "Send and get my certificate"}
          </button>
        )}
      </div>

      {step === LAST_STEP ? (
        <p className="text-sm text-ink/60">
          You can only send this once, so take a second to check it over.
        </p>
      ) : null}
    </form>
  );
}

const chip =
  "cursor-pointer rounded border border-ink/25 bg-white py-3 text-center font-semibold transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-white";

function QuestionField({
  question,
  defaultValue,
}: {
  question: Question;
  defaultValue: string | string[];
}) {
  if (question.kind === "rating") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {RATING_SCALE.map((point) => (
            <label key={point} className={`flex-1 ${chip}`}>
              <input
                type="radio"
                name={question.id}
                value={point}
                defaultChecked={defaultValue === String(point)}
                className="sr-only"
              />
              {point}
            </label>
          ))}
          {question.allowNA ? (
            <label className={`flex-1 text-sm ${chip}`}>
              <input
                type="radio"
                name={question.id}
                value={NOT_APPLICABLE}
                defaultChecked={defaultValue === NOT_APPLICABLE}
                className="sr-only"
              />
              N/A
            </label>
          ) : null}
        </div>
        <div className="flex justify-between text-xs uppercase tracking-wide text-ink/50">
          <span>{RATING_LABELS[1]}</span>
          <span>{question.allowNA ? "N/A = didn’t take part" : RATING_LABELS[5]}</span>
        </div>
      </div>
    );
  }

  if (question.kind === "choice" || question.kind === "multi") {
    const multi = question.kind === "multi";
    const ticked = [defaultValue].flat();
    return (
      <div className={multi ? "grid gap-2 sm:grid-cols-2" : "flex flex-col gap-2"}>
        {question.options.map((option) => (
          <label
            key={option}
            className="cursor-pointer rounded border border-ink/25 bg-white px-4 py-3 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/10"
          >
            <input
              type={multi ? "checkbox" : "radio"}
              name={question.id}
              value={option}
              defaultChecked={ticked.includes(option)}
              className="mr-3 accent-accent"
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  return (
    <textarea
      name={question.id}
      rows={3}
      maxLength={MAX_TEXT_LENGTH}
      placeholder={question.placeholder}
      defaultValue={[defaultValue].flat()[0] ?? ""}
      className="w-full rounded border border-ink/25 bg-white px-3 py-2.5 placeholder:text-ink/40 focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent"
    />
  );
}
