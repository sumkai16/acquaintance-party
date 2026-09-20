"use client";

import { useActionState, useState } from "react";
import { MAX_DEPARTMENT_LENGTH } from "@/lib/faculty/schema";
import { submitAcknowledgement, type FormState } from "./actions";

const initial: FormState = { status: "idle", attempt: 0 };

const inputClass =
  "w-full rounded border border-ink/25 bg-white px-3 py-2.5 " +
  "placeholder:text-ink/40 disabled:bg-ink/5 disabled:text-ink/40 " +
  "focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent";

/**
 * The acknowledgement, which is also the giveaway entry.
 *
 * The tick comes first and gates the name field: the entry is meant to record
 * that someone read the letter, so a form that could be filled from the top
 * down without the checkbox ever being noticed would make the record a lie.
 * The server re-checks it regardless — see submitAcknowledgement.
 */
export function InvitationForm() {
  const [state, action, pending] = useActionState(submitAcknowledgement, initial);
  const [acknowledged, setAcknowledged] = useState(false);
  const errors = state.fieldErrors ?? {};

  // Same remount-on-attempt trick as checkout-form.tsx: React resets an
  // uncontrolled field when the action finishes without redirecting, so
  // keying on the attempt number restores what they actually typed.
  const keyed = (name: string) => `${name}-${state.attempt}`;

  if (state.status === "entered") {
    return <Confirmed message={state.message} name={state.values?.fullName} />;
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.message ? (
        <p
          role="alert"
          className="rounded border border-accent/30 bg-accent/10 px-4 py-3 text-accent"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-3 font-semibold">
          <input
            type="checkbox"
            name="acknowledged"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
          />
          <span>I have read this letter of invitation.</span>
        </label>
        {errors.acknowledged ? (
          <p className="text-sm font-medium text-accent">{errors.acknowledged}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="font-semibold">
          Your full name
        </label>
        <p className="text-sm text-ink/70">
          This is the name that goes into the faculty giveaway, so write it the
          way you want it read out.
        </p>
        <input
          key={keyed("fullName")}
          id="fullName"
          name="fullName"
          required
          disabled={!acknowledged}
          autoComplete="name"
          placeholder="Juana D. Santos"
          defaultValue={state.values?.fullName ?? ""}
          className={inputClass}
        />
        {errors.fullName ? (
          <p className="text-sm font-medium text-accent">{errors.fullName}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="department" className="font-semibold">
          Department <span className="font-normal text-ink/60">(optional)</span>
        </label>
        <input
          key={keyed("department")}
          id="department"
          name="department"
          disabled={!acknowledged}
          maxLength={MAX_DEPARTMENT_LENGTH}
          placeholder="e.g. BSIT"
          defaultValue={state.values?.department ?? ""}
          className={inputClass}
        />
        {errors.department ? (
          <p className="text-sm font-medium text-accent">{errors.department}</p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending || !acknowledged}
        className="self-start rounded-full bg-accent px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-accent disabled:opacity-50"
      >
        {pending ? "Sending…" : "Confirm and enter"}
      </button>
    </form>
  );
}

function Confirmed({ message, name }: { message?: string; name?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-accent-3/40 bg-accent-3/10 px-5 py-6"
    >
      <p className="font-display text-2xl uppercase text-accent">
        {message ?? "You're on the list."}
      </p>
      {name ? <p className="text-ink/70">Entered as {name}.</p> : null}
      <p className="text-ink/70">
        Nothing else to do — we look forward to seeing you. The giveaway is
        drawn during the programme.
      </p>
    </div>
  );
}
