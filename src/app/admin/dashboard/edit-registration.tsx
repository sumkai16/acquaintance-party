"use client";

import { useState, useTransition } from "react";
import {
  STUDENT_ID_INPUT_PATTERN,
  STUDENT_ID_PLACEHOLDER,
  YEAR_LEVELS,
} from "@/lib/registrations/schema";
import { sectionsFor } from "@/lib/registrations/sections";
import { Option } from "../option";
import { useFlash } from "../flash";
import type { Registration } from "@/lib/supabase/types";
import { editRegistration } from "./actions";

const fieldClass =
  "w-full rounded border border-ground/20 bg-ground/5 px-2 py-1.5 text-xs text-ground placeholder:text-ground/40 focus:border-accent-2 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 [color-scheme:dark]";

/**
 * Inline correction of the identity fields on one row — the answer to a
 * staff typo, which before this meant editing the table by hand in Supabase
 * with no validation and no trace.
 *
 * It sits inside the row's first cell, replacing the same four lines it is
 * editing, so a correction happens where the mistake is visible rather than
 * on a separate screen that has to be navigated to and matched back up.
 *
 * Section resets whenever year changes, because the options are per-year
 * (sectionsFor) — keeping a stale "Section G" selected while the year moves
 * to one that has no G is how you submit a pair the schema then rejects.
 */
export function EditRegistration({
  registration,
  onDone,
}: {
  registration: Registration;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const flash = useFlash();

  const [fullName, setFullName] = useState(registration.full_name);
  const [studentId, setStudentId] = useState(registration.student_id);
  const [yearLevel, setYearLevel] = useState(registration.year_level);
  const [section, setSection] = useState(registration.section);
  const [email, setEmail] = useState(registration.email);

  function save() {
    startTransition(async () => {
      const result = await editRegistration(registration.id, {
        fullName,
        studentId,
        yearLevel,
        section,
        email,
      });
      if (!result.ok) {
        flash(result.error ?? "Something went wrong.", "error");
        return;
      }
      flash(`Updated ${fullName}.`);
      onDone();
    });
  }

  return (
    <div className="flex w-72 flex-col gap-1.5">
      <input
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        aria-label="Full name"
        placeholder="Full name"
        className={fieldClass}
      />

      <input
        value={studentId}
        onChange={(event) => setStudentId(event.target.value)}
        aria-label="Student ID"
        placeholder={STUDENT_ID_PLACEHOLDER}
        pattern={STUDENT_ID_INPUT_PATTERN}
        title="SCC, the two-digit entry year, then eight digits — e.g. SCC-24-00012345"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className={`${fieldClass} uppercase`}
      />

      <div className="flex gap-1.5">
        <select
          value={yearLevel}
          onChange={(event) => {
            setYearLevel(event.target.value);
            setSection("");
          }}
          aria-label="Year level"
          className={fieldClass}
        >
          {YEAR_LEVELS.map((level) => (
            <Option key={level} value={level}>
              {level}
            </Option>
          ))}
        </select>

        <select
          value={section}
          onChange={(event) => setSection(event.target.value)}
          aria-label="Section"
          className={fieldClass}
        >
          <Option value="">Section…</Option>
          {sectionsFor(yearLevel).map((option) => (
            <Option key={option} value={option}>
              {option}
            </Option>
          ))}
        </select>
      </div>

      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        type="email"
        aria-label="Email"
        placeholder="juan@example.com"
        className={fieldClass}
      />

      <div className="flex items-center gap-3 pt-0.5">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="font-semibold text-accent-2 underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onDone}
          className="text-ground/60 underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
