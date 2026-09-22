"use client";

import { useActionState } from "react";
import {
  STUDENT_ID_INPUT_PATTERN,
  STUDENT_ID_PLACEHOLDER,
} from "@/lib/registrations/schema";
import { requestEmailCorrection, type EmailFixState } from "./actions";

const initial: EmailFixState = { status: "idle" };

const inputClass =
  "w-full rounded border border-ink/25 bg-white px-3 py-2.5 " +
  "placeholder:text-ink/40 " +
  "focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent";

/**
 * Shown only after a no-match on the main lookup — the one situation this
 * is actually for is "the email on file is wrong," which is also exactly
 * why the main lookup just failed. Never changes anything itself; see
 * requestEmailCorrection's comment for why that has to stay a human step.
 */
export function RequestEmailFix({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState(requestEmailCorrection, initial);
  const errors = state.fieldErrors ?? {};

  if (state.status === "sent") {
    return (
      <p className="rounded border border-ink/20 bg-white/60 px-4 py-3 text-sm text-ink/80">
        {state.message}
      </p>
    );
  }

  return (
    <details className="rounded border border-ink/20 bg-white/60 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-ink/70 focus:outline-2 focus:outline-offset-2 focus:outline-accent">
        Wrong email on file? Request a fix
      </summary>

      <form action={action} noValidate className="mt-4 flex flex-col gap-4">
        {state.status === "error" && state.message ? (
          <p role="alert" className="text-sm font-medium text-accent">
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="fix-studentId" className="text-sm font-semibold">
            Student ID
          </label>
          <input
            id="fix-studentId"
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
          <label htmlFor="fix-fullName" className="text-sm font-semibold">
            Full name
          </label>
          <input
            id="fix-fullName"
            name="fullName"
            required
            placeholder="Juan Dela Cruz"
            className={inputClass}
          />
          {errors.fullName ? (
            <p className="text-sm font-medium text-accent">{errors.fullName}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="fix-requestedEmail" className="text-sm font-semibold">
            The email it should be
          </label>
          <input
            id="fix-requestedEmail"
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

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded bg-accent px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Request fix"}
        </button>

        <p className="text-xs text-ink/60">
          An organiser checks this by hand before changing anything — it isn&apos;t instant.
        </p>
      </form>
    </details>
  );
}
