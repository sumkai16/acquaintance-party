"use client";

import { useActionState } from "react";
import { openMyEvaluation, type LookupState } from "./actions";

const initial: LookupState = { status: "idle" };

const inputClass =
  "w-full rounded border border-ink/25 bg-white px-3 py-2.5 placeholder:text-ink/40 " +
  "focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent";

export function LookupForm() {
  const [state, action, pending] = useActionState(openMyEvaluation, initial);

  return (
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
        <label htmlFor="name" className="font-semibold">
          Your name
        </label>
        <p className="text-sm text-ink/70">
          The name you registered with. Type it as Last name, First name, M.I. or
          First name, M.I., Last name.
        </p>
        <input
          id="name"
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={state.values?.name}
          placeholder="Dela Cruz, Juan M."
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="font-semibold">
          Your email
        </label>
        <p className="text-sm text-ink/70">
          The email you registered with. It proves the name is yours.
        </p>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={state.values?.email}
          placeholder="juan@example.com"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-6 py-3 font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      >
        {pending ? "Looking you up…" : "Open my evaluation"}
      </button>
    </form>
  );
}
