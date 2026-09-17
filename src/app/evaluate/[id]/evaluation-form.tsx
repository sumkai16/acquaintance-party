"use client";

import { useActionState } from "react";
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

export function EvaluationForm({ registrationId }: { registrationId: string }) {
  const action = submitEvaluation.bind(null, registrationId);
  const [state, formAction, pending] = useActionState(action, initial);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  // See the comment on FormState.values in actions.ts — remounting on the
  // attempt number is what keeps answered questions answered after an error.
  const keyed = (id: string) => `${id}-${state.attempt}`;
  const missed = Object.keys(errors).length;

  return (
    // noValidate for the same reason as checkout-form.tsx: parseAnswers
    // reports every missed question in one pass, which the browser's own
    // one-at-a-time validation would pre-empt.
    <form action={formAction} noValidate className="flex flex-col gap-10">
      {state.message ? (
        <p
          role="alert"
          className="rounded border border-accent/30 bg-accent/10 px-4 py-3 text-accent"
        >
          {state.message}
          {missed > 0 ? ` ${missed} still need an answer.` : null}
        </p>
      ) : null}

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

      {SECTIONS.map((section) => (
        <section key={section.id} className="flex flex-col gap-7">
          <h2 className="border-b border-ink/15 pb-2 font-display text-2xl uppercase text-accent">
            {section.title}
          </h2>
          {section.questions.map((question) => (
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

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-6 py-3.5 font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      >
        {pending ? "Sending…" : "Send and get my certificate"}
      </button>

      <p className="text-sm text-ink/60">
        You can only send this once, so take a second to check it over.
      </p>
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
