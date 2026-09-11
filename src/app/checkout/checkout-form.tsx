"use client";

import { useActionState, useState } from "react";
import {
  STUDENT_ID_INPUT_PATTERN,
  STUDENT_ID_PLACEHOLDER,
  YEAR_LEVELS,
} from "@/lib/registrations/schema";
import { sectionsFor } from "@/lib/registrations/sections";
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
    // noValidate: the browser's own required-field validation stops at the
    // first empty field and blocks the submit entirely, so a student sees
    // one error, fixes it, resubmits, and hits the next one — one at a
    // time. Skipping it lets every submit reach submitRegistration, whose
    // Zod check already reports every invalid field (plus the receipt) in
    // a single pass.
    <form action={action} noValidate className="flex flex-col gap-5">
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
          placeholder={STUDENT_ID_PLACEHOLDER}
          defaultValue={values?.studentId ?? ""}
          // Shown in caps as it's typed, and stored that way too — the
          // schema uppercases the value (normalizeStudentId), so this is
          // the display half of the same rule. A CSS transform rather than
          // rewriting the input's value on each keystroke, which would
          // throw the caret to the end when someone corrects a character
          // mid-ID. autoCapitalize gets a phone keyboard to start in caps.
          // Native check before the round trip, so a malformed ID is caught
          // while the field is still focused rather than after a submit.
          pattern={STUDENT_ID_INPUT_PATTERN}
          title="SCC, your two-digit entry year, then eight digits — e.g. SCC-24-00012345"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={`${inputClass} uppercase`}
        />
      </Field>

      <YearAndSection
        key={keyed("yearAndSection")}
        defaultYearLevel={values?.yearLevel ?? ""}
        defaultSection={values?.section ?? ""}
        yearLevelError={errors.yearLevel}
        sectionError={errors.section}
      />

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

/**
 * Year level and Section, together, because Section's options come from the
 * chosen year — 1st year runs A–G, 4th year stops at D. Pulled into its own
 * component so the caller can key it on the attempt number, which restores
 * both picks after a failed submit the same way `keyed()` does elsewhere.
 */
function YearAndSection({
  defaultYearLevel,
  defaultSection,
  yearLevelError,
  sectionError,
}: {
  defaultYearLevel: string;
  defaultSection: string;
  yearLevelError?: string;
  sectionError?: string;
}) {
  // Only the year level is tracked, and only to pick the Section options.
  // Both selects stay uncontrolled on `defaultValue`, like every other field
  // here: a controlled <select> that remounts gets its value applied before
  // its <option> children exist, and silently falls back to the first one.
  const [yearLevel, setYearLevel] = useState(defaultYearLevel);
  const sections = sectionsFor(yearLevel);

  return (
    <>
      <Field label="Year level" name="yearLevel" error={yearLevelError}>
        <select
          id="yearLevel"
          name="yearLevel"
          required
          defaultValue={defaultYearLevel}
          onChange={(event) => setYearLevel(event.target.value)}
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

      <Field label="Section" name="section" error={sectionError}>
        <select
          id="section"
          name="section"
          required
          // Remounts on every year change, which is what clears a stale pick:
          // 4th year has no G, so carrying one over would submit a section
          // that year doesn't have. The restored value only applies on the
          // first render, before the student has touched the year level.
          key={yearLevel}
          defaultValue={yearLevel === defaultYearLevel ? defaultSection : ""}
          disabled={sections.length === 0}
          className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <option value="" disabled>
            {sections.length === 0
              ? "Pick a year level first"
              : "Select your section"}
          </option>
          {sections.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
    </>
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
