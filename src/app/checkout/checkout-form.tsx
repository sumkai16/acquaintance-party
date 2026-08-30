"use client";

import { useActionState } from "react";
import { YEAR_LEVELS } from "@/lib/registrations/schema";
import { submitRegistration, type FormState } from "./actions";

const initial: FormState = { status: "idle" };

const inputClass =
  "w-full rounded border border-ink/25 bg-white px-3 py-2.5 " +
  "focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent";

export function CheckoutForm() {
  const [state, action, pending] = useActionState(submitRegistration, initial);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.message ? (
        <p
          role="alert"
          className="rounded border border-accent/30 bg-accent/10 px-4 py-3 text-accent"
        >
          {state.message}
        </p>
      ) : null}

      <Field label="Full name" name="fullName" error={errors.fullName}>
        <input
          id="fullName"
          name="fullName"
          required
          autoComplete="name"
          className={inputClass}
        />
      </Field>

      <Field label="Year level" name="yearLevel" error={errors.yearLevel}>
        <select
          id="yearLevel"
          name="yearLevel"
          required
          defaultValue=""
          className={inputClass}
        >
          <option value="" disabled>
            Select your year level
          </option>
          {YEAR_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Section" name="section" error={errors.section}>
        <input id="section" name="section" required className={inputClass} />
      </Field>

      <Field
        label="Personal email"
        name="email"
        hint="Your ticket is tied to this address, so we can find it if you lose the link."
        error={errors.email}
      >
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
        />
      </Field>

      <Field
        label="GCash reference number"
        name="gcashReference"
        hint="The 13-digit number on your GCash receipt."
        error={errors.gcashReference}
      >
        <input
          id="gcashReference"
          name="gcashReference"
          required
          inputMode="numeric"
          className={`${inputClass} font-mono`}
        />
      </Field>

      <Field
        label="Receipt screenshot"
        name="receipt"
        hint="JPG, PNG, or WebP, under 5 MB."
        error={errors.receipt}
      >
        <input
          id="receipt"
          name="receipt"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp"
          className="w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-ink/10 file:px-4 file:py-2 file:font-semibold"
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-accent px-6 py-3.5 font-semibold uppercase tracking-wide text-ground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit for review"}
      </button>

      <p className="text-sm text-ink/65">
        We check every payment by hand. Your QR ticket appears on the next page
        once an organiser approves it.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  hint,
  error,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="font-semibold">
        {label}
      </label>
      {hint ? <p className="text-sm text-ink/65">{hint}</p> : null}
      {children}
      {error ? <p className="text-sm font-medium text-accent">{error}</p> : null}
    </div>
  );
}
