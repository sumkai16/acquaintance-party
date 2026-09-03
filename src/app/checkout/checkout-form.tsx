"use client";

import { useActionState } from "react";
import { YEAR_LEVELS } from "@/lib/registrations/schema";
import { submitRegistration, type FormState } from "./actions";

const initial: FormState = { status: "idle", attempt: 0 };

const inputClass =
  "w-full rounded border border-ink/25 bg-white px-3 py-2.5 " +
  "placeholder:text-ink/40 " +
  "focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent";

export function CheckoutForm() {
  const [state, action, pending] = useActionState(submitRegistration, initial);
  const errors = state.fieldErrors ?? {};
  const values = state.values;

  // React resets every uncontrolled field once the action finishes without
  // redirecting — see the comment on FormState.values in actions.ts. Keying
  // each input on the attempt number forces it to remount with the value
  // the student actually typed, instead of going blank on any error.
  const keyed = (name: string) => `${name}-${state.attempt}`;

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
          key={keyed("fullName")}
          id="fullName"
          name="fullName"
          required
          autoComplete="name"
          placeholder="Juan Dela Cruz"
          defaultValue={values?.fullName ?? ""}
          className={inputClass}
        />
      </Field>

      <Field label="Student ID" name="studentId" error={errors.studentId}>
        <input
          key={keyed("studentId")}
          id="studentId"
          name="studentId"
          required
          placeholder="SCC-00-0000000"
          defaultValue={values?.studentId ?? ""}
          className={inputClass}
        />
      </Field>

      <Field label="Year level" name="yearLevel" error={errors.yearLevel}>
        <select
          key={keyed("yearLevel")}
          id="yearLevel"
          name="yearLevel"
          required
          defaultValue={values?.yearLevel ?? ""}
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
        <input
          key={keyed("section")}
          id="section"
          name="section"
          required
          placeholder="BSIT-3B"
          defaultValue={values?.section ?? ""}
          className={inputClass}
        />
      </Field>

      <Field
        label="Personal email"
        name="email"
        hint="Your ticket is tied to this address, so we can find it if you lose the link."
        error={errors.email}
      >
        <input
          key={keyed("email")}
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="juan@example.com"
          defaultValue={values?.email ?? ""}
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
          key={keyed("gcashReference")}
          id="gcashReference"
          name="gcashReference"
          required
          inputMode="numeric"
          placeholder="1234567890123"
          defaultValue={values?.gcashReference ?? ""}
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
        className="rounded bg-accent px-6 py-3.5 font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit"}
      </button>

      <p className="text-sm text-ink/70">
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
      {hint ? <p className="text-sm text-ink/70">{hint}</p> : null}
      {children}
      {error ? <p className="text-sm font-medium text-accent">{error}</p> : null}
    </div>
  );
}
