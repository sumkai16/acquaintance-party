"use client";

import { useActionState, useEffect } from "react";
import { YEAR_LEVELS } from "@/lib/registrations/schema";
import { useFlash } from "../flash";
import { Option } from "../option";
import { submitWalkIn, type FormState } from "./actions";

const initial: FormState = { status: "idle", attempt: 0 };

const inputClass =
  "w-full rounded border border-ground/25 bg-deep px-3 py-2.5 text-ground " +
  "placeholder:text-ground/40 focus:border-accent-2 focus:outline-2 " +
  "focus:outline-offset-2 focus:outline-accent-2 [color-scheme:dark]";

export function WalkInForm() {
  const [state, action, pending] = useActionState(submitWalkIn, initial);
  const errors = state.fieldErrors ?? {};
  const values = state.values;
  const flash = useFlash();

  // Recording a walk-in stays on this page — no ticket-page redirect — so
  // the next sale can be entered right away. A flash is the only signal
  // that it worked; fires once per successful attempt, not on first mount.
  useEffect(() => {
    if (state.status === "success" && state.message) flash(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.attempt, state.status]);

  // Same remount-on-attempt trick as checkout-form.tsx — see the comment on
  // FormState.values in actions.ts.
  const keyed = (name: string) => `${name}-${state.attempt}`;

  return (
    // noValidate — see the comment on checkout-form.tsx's form. Without it,
    // the browser's own required-field validation stops at the first empty
    // field instead of letting submitWalkIn report every invalid field at
    // once.
    <form action={action} noValidate className="flex flex-col gap-5">
      {state.status === "error" && state.message ? (
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
          autoFocus
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
          <Option value="" disabled>
            Select a year level
          </Option>
          {YEAR_LEVELS.map((level) => (
            <Option key={level} value={level}>
              {level}
            </Option>
          ))}
        </select>
      </Field>

      <Field label="Section" name="section" error={errors.section}>
        <input
          key={keyed("section")}
          id="section"
          name="section"
          required
          placeholder="e.g A,B,C"
          defaultValue={values?.section ?? ""}
          className={inputClass}
        />
      </Field>

      <Field
        label="Email"
        name="email"
        hint="So they still get a copy of their ticket link."
        error={errors.email}
      >
        <input
          key={keyed("email")}
          id="email"
          name="email"
          type="email"
          required
          placeholder="juan@example.com"
          defaultValue={values?.email ?? ""}
          className={inputClass}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-6 py-3.5 font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      >
        {pending ? "Saving…" : "Record cash sale"}
      </button>

      <p className="text-sm text-ground/60">
        Approved immediately — only enter this once you have the cash in
        hand. Their ticket link is emailed to them, and this form clears so
        you can enter the next sale.
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
      <label htmlFor={name} className="font-semibold text-ground">
        {label}
      </label>
      {hint ? <p className="text-sm text-ground/60">{hint}</p> : null}
      {children}
      {error ? <p className="text-sm font-medium text-accent">{error}</p> : null}
    </div>
  );
}
