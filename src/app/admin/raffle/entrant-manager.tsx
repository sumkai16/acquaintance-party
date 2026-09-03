"use client";

import { useRef, useState } from "react";
import { YEAR_LEVELS } from "@/lib/registrations/schema";
import type { RaffleEntrant } from "@/lib/raffle/types";
import { addEntrant, importEntrants, removeEntrant } from "./entrant-actions";

/**
 * The escape hatch: add someone the scanner missed, or import a walk-in
 * list. The scanned-in pool is still the default and the primary
 * eligibility path — this only ever supplements it, and every addition here
 * is a deliberate, visible admin action.
 */
export function EntrantManager({
  extras,
  onAdd,
  onAddMany,
  onRemove,
}: {
  extras: RaffleEntrant[];
  onAdd: (entrant: RaffleEntrant) => void;
  onAddMany: (entrants: RaffleEntrant[]) => void;
  onRemove: (id: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [section, setSection] = useState("");
  const [pending, setPending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    setPending(true);
    setError(null);
    setNotice(null);
    const result = await addEntrant({
      fullName,
      yearLevel: yearLevel || undefined,
      section: section || undefined,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAdd(result.entrant);
    setFullName("");
    setYearLevel("");
    setSection("");
    if (result.warning) setNotice(result.warning);
  }

  async function handleRemove(id: string) {
    setError(null);
    const result = await removeEntrant(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onRemove(id);
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);
    setNotice(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await importEntrants(formData);
    setImporting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAddMany(result.added);
    if (fileRef.current) fileRef.current.value = "";
    const parts = [`Added ${result.added.length}`];
    if (result.skipped > 0) parts.push(`skipped ${result.skipped} blank row(s)`);
    setNotice([...parts, ...result.warnings].join(". "));
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ground/70">
        Extra entrants
      </h2>
      <p className="text-sm text-ground/50">
        For someone the scanner missed, or a name from outside the ticket
        system. The scanned-in pool is still the default — this only adds to
        it.
      </p>

      <ul className="flex flex-col gap-1.5">
        {extras.map((entrant) => (
          <li
            key={entrant.registrationId}
            className="flex items-center gap-2 rounded border border-ground/15 bg-deep/40 px-3 py-2 text-sm"
          >
            <span className="flex-1">
              {entrant.fullName}
              <span className="text-ground/50">
                {" "}
                · {entrant.yearLevel} · {entrant.section}
              </span>
            </span>
            <button
              type="button"
              onClick={() => handleRemove(entrant.registrationId)}
              className="rounded px-2 py-1 text-accent-2 hover:opacity-80"
              aria-label={`Remove ${entrant.fullName}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
        className="flex flex-col gap-2"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full name"
            className="rounded border border-ground/25 bg-deep px-3 py-2 focus:border-accent-3 focus:outline-2 focus:outline-offset-2 focus:outline-accent-3 sm:col-span-1"
          />
          <select
            value={yearLevel}
            onChange={(e) => setYearLevel(e.target.value)}
            className="rounded border border-ground/25 bg-deep px-3 py-2"
          >
            <option value="">Year level (optional)</option>
            {YEAR_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <input
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="Section (optional)"
            className="rounded border border-ground/25 bg-deep px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={pending || fullName.trim().length < 2}
          className="self-start rounded bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add name"}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-ground/15 pt-3">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="text-sm text-ground/70 file:mr-3 file:rounded file:border-0 file:bg-ground/10 file:px-3 file:py-1.5 file:text-ground"
        />
        <button
          type="button"
          disabled={importing}
          onClick={handleImport}
          className="rounded border border-ground/25 px-4 py-2 font-semibold hover:border-ground/50 disabled:opacity-50"
        >
          {importing ? "Importing…" : "Import from Excel"}
        </button>
        <p className="w-full text-xs text-ground/45">
          Header row required. Full name (or Name) is required; Year level
          and Section are optional.
        </p>
      </div>

      {notice ? <p className="text-sm text-accent-3">{notice}</p> : null}
      {error ? <p className="text-sm text-accent-2">{error}</p> : null}
    </div>
  );
}
