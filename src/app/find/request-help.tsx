"use client";

import { useActionState, useState } from "react";
import {
  HELP_CATEGORIES,
  type HelpCategory,
  STUDENT_ID_INPUT_PATTERN,
  STUDENT_ID_PLACEHOLDER,
} from "@/lib/registrations/schema";
import { requestHelp, type HelpState } from "./actions";

const initial: HelpState = { status: "idle" };

const inputClass =
  "w-full rounded border border-ink/25 bg-white px-3 py-2.5 " +
  "placeholder:text-ink/40 " +
  "focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent";

/**
 * Always under the lookup, collapsed. A no-match on the lookup opens it
 * with "wrong email" picked, since that's the likeliest reason the lookup
 * just failed. Never changes anything itself — see requestHelp's comment
 * for why that has to stay a human step.
 */
export function RequestHelp({
  studentId,
  open,
  defaultCategory,
}: {
  studentId: string;
  open: boolean;
  defaultCategory?: HelpCategory;
}) {
  const [state, action, pending] = useActionState(requestHelp, initial);
  const [category, setCategory] = useState<HelpCategory | undefined>(defaultCategory);
  const errors = state.fieldErrors ?? {};

  if (state.status === "sent") {
    return (
      <p className="rounded border border-ink/20 bg-white/60 px-4 py-3 text-sm text-ink/80">
        {state.message}
      </p>
    );
  }

  return (
    <details open={open} className="rounded border border-ink/20 bg-white/60 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-ink/70 focus:outline-2 focus:outline-offset-2 focus:outline-accent">
        Still stuck? Report a QR problem
      </summary>

      <form action={action} noValidate className="mt-4 flex flex-col gap-4">
        {state.status === "error" && state.message ? (
          <p role="alert" className="text-sm font-medium text-accent">
            {state.message}
          </p>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">What&apos;s wrong?</legend>
          {(Object.keys(HELP_CATEGORIES) as HelpCategory[]).map((key) => (
            <label key={key} className="flex items-start gap-2.5 py-1 text-sm">
              <input
                type="radio"
                name="category"
                value={key}
                checked={category === key}
                onChange={() => setCategory(key)}
                className="mt-0.5 size-4 accent-accent"
              />
              {HELP_CATEGORIES[key]}
            </label>
          ))}
          {errors.category ? (
            <p className="text-sm font-medium text-accent">{errors.category}</p>
          ) : null}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="help-studentId" className="text-sm font-semibold">
            Student ID
          </label>
          <input
            id="help-studentId"
            name="studentId"
            required
            defaultValue={studentId}
            placeholder={STUDENT_ID_PLACEHOLDER}
            pattern={STUDENT_ID_INPUT_PATTERN}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={`${inputClass} uppercase`}
          />
          {errors.studentId ? (
            <p className="text-sm font-medium text-accent">{errors.studentId}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="help-fullName" className="text-sm font-semibold">
            Full name
          </label>
          <input
            id="help-fullName"
            name="fullName"
            required
            placeholder="Juan Dela Cruz"
            className={inputClass}
          />
          {errors.fullName ? (
            <p className="text-sm font-medium text-accent">{errors.fullName}</p>
          ) : null}
        </div>

        {category === "wrong_email" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="help-requestedEmail" className="text-sm font-semibold">
              The email it should be
            </label>
            <input
              id="help-requestedEmail"
              name="requestedEmail"
              type="email"
              required
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="juan@example.com"
              className={inputClass}
            />
            {errors.requestedEmail ? (
              <p className="text-sm font-medium text-accent">{errors.requestedEmail}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="help-message" className="text-sm font-semibold">
            Details{category === "other" ? "" : " (optional)"}
          </label>
          <textarea
            id="help-message"
            name="message"
            rows={3}
            maxLength={500}
            placeholder="e.g. I paid through GCash on Sept 25 at 3 PM"
            className={inputClass}
          />
          {errors.message ? (
            <p className="text-sm font-medium text-accent">{errors.message}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded bg-accent px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send"}
        </button>

        <p className="text-xs text-ink/60">
          An organiser checks this by hand. It isn&apos;t instant.
        </p>
      </form>
    </details>
  );
}
