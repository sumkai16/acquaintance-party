"use client";

import { useActionState } from "react";
import {
  MAX_TEXT_LENGTH,
  QUESTIONS,
  RATING_SCALE,
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

  return (
    // noValidate for the same reason as checkout-form.tsx: parseAnswers
    // reports every missed question in one pass, which the browser's own
    // one-at-a-time validation would pre-empt.
    <form action={formAction} noValidate className="flex flex-col gap-8">
      {state.message ? (
        <p
          role="alert"
          className="rounded border border-accent/30 bg-accent/10 px-4 py-3 text-accent"
        >
          {state.message}
        </p>
      ) : null}

      {QUESTIONS.map((question) => (
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

function QuestionField({
  question,
  defaultValue,
}: {
  question: Question;
  defaultValue: string;
}) {
  if (question.kind === "rating") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {RATING_SCALE.map((point) => (
            <label
              key={point}
              className="flex-1 cursor-pointer rounded border border-ink/25 bg-white py-3 text-center font-semibold transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-white"
            >
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
        </div>
        <div className="flex justify-between text-xs uppercase tracking-wide text-ink/50">
          <span>{question.lowLabel}</span>
          <span>{question.highLabel}</span>
        </div>
      </div>
    );
  }

  if (question.kind === "choice") {
    return (
      <div className="flex flex-col gap-2">
        {question.options.map((option) => (
          <label
            key={option}
            className="cursor-pointer rounded border border-ink/25 bg-white px-4 py-3 transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/10"
          >
            <input
              type="radio"
              name={question.id}
              value={option}
              defaultChecked={defaultValue === option}
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
      defaultValue={defaultValue}
      className="w-full rounded border border-ink/25 bg-white px-3 py-2.5 placeholder:text-ink/40 focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent"
    />
  );
}
