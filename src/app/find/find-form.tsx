"use client";

import { useActionState, useState } from "react";
import { STUDENT_ID_INPUT_PATTERN, STUDENT_ID_PLACEHOLDER } from "@/lib/registrations/schema";
import { findTicket, type FindState } from "./actions";
import { RequestHelp } from "./request-help";

const initial: FindState = { status: "idle" };

const inputClass =
  "w-full rounded border border-ink/25 bg-white px-3 py-2.5 " +
  "placeholder:text-ink/40 " +
  "focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent";

export function FindForm() {
  const [state, action, pending] = useActionState(findTicket, initial);
  // Tracked (not just a defaultValue) so a no-match result can hand the
  // student ID they just typed straight to the "report a problem" form below —
  // typing it twice is exactly the friction this is meant to remove.
  const [studentIdValue, setStudentIdValue] = useState("");
  const noMatch = state.reason === "no_match";

  return (
    <div className="flex flex-col gap-6">
      <form action={action} noValidate className="flex flex-col gap-5">
        {state.status === "error" && state.message ? (
          <p
            role="alert"
            className="rounded border border-accent/30 bg-accent/10 px-4 py-3 text-accent"
          >
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="studentId" className="font-semibold">
            Student ID
          </label>
          <input
            id="studentId"
            name="studentId"
            required
            value={studentIdValue}
            onChange={(event) => setStudentIdValue(event.target.value)}
            placeholder={STUDENT_ID_PLACEHOLDER}
            pattern={STUDENT_ID_INPUT_PATTERN}
            title="SCC, your two-digit entry year, then your serial — e.g. SCC-24-0012345"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={`${inputClass} uppercase`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="font-semibold">
            Email
          </label>
          <p className="text-sm text-ink/70">
            The email you registered with — not necessarily the one you&apos;re
            checking now.
          </p>
          <input
            id="email"
            name="email"
            type="email"
            required
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="juan@example.com"
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-6 py-3.5 font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Looking…" : "Find my ticket"}
        </button>
      </form>

      {/* Remounted on a no-match so it opens with the student ID just typed
          and "wrong email" picked — the likeliest reason the lookup failed. */}
      <RequestHelp
        key={noMatch ? "no-match" : "idle"}
        studentId={studentIdValue}
        open={noMatch}
        defaultCategory={noMatch ? "wrong_email" : undefined}
      />
    </div>
  );
}
