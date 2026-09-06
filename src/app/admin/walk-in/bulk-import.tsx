"use client";

import { createContext, useContext, useRef, useState } from "react";
import { Table, Th, Tr } from "../table";
import { useFlash } from "../flash";
import { confirmWalkInImport, parseWalkInImport, type ParsedWalkInRow } from "./import-actions";

/**
 * Split from the panel below so the toggle button can sit up in the page
 * header (an eye-catching, designed button next to the title) while the
 * review table it opens stays down where the form's flow leaves off — both
 * need the same open/closed state, so it's lifted into this small context
 * rather than each owning its own, same shape as NavVisibilityProvider.
 */
const BulkImportContext = createContext<
  { open: boolean; setOpen: (open: boolean) => void } | null
>(null);

export function BulkImportProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <BulkImportContext.Provider value={{ open, setOpen }}>{children}</BulkImportContext.Provider>
  );
}

function useBulkImport() {
  const ctx = useContext(BulkImportContext);
  if (!ctx) throw new Error("useBulkImport must be used within BulkImportProvider");
  return ctx;
}

/** The eye-catching entry point, meant for the page header next to the title. */
export function BulkImportToggle() {
  const { open, setOpen } = useBulkImport();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0">
        <rect x="3" y="4" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth={1.5} />
        <path d="M3 8.5h14M8 4v12" stroke="currentColor" strokeWidth={1.5} />
      </svg>
      {open ? "Hide bulk import" : "Bulk import from Excel"}
      <svg
        viewBox="0 0 20 20"
        fill="none"
        className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      >
        <path
          d="M5 7.5l5 5 5-5"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * Wraps the single-entry form: side by side with the import panel to its
 * right while the panel is open, centered on its own when it's not — same
 * open state the toggle/panel already share, just deciding layout instead
 * of visibility here.
 */
export function WalkInLayout({ children }: { children: React.ReactNode }) {
  const { open } = useBulkImport();
  return (
    <div
      className={`flex flex-col items-start gap-8 lg:flex-row ${open ? "" : "lg:justify-center"}`}
    >
      <div className={`w-full max-w-md ${open ? "" : "lg:mx-auto"}`}>{children}</div>
      <BulkImportPanel />
    </div>
  );
}

export function BulkImportPanel() {
  const { open } = useBulkImport();
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rows, setRows] = useState<ParsedWalkInRow[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const flash = useFlash();

  const validRows = rows?.filter((row) => row.ok) ?? [];
  const allValidChecked = validRows.length > 0 && validRows.every((row) => checked.has(row.rowNumber));

  function reset() {
    setRows(null);
    setChecked(new Set());
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleParse() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      flash("Choose a file first.", "error");
      return;
    }

    setParsing(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await parseWalkInImport(formData);
    setParsing(false);

    if (!result.ok) {
      flash(result.error, "error");
      return;
    }
    setRows(result.rows);
    setChecked(new Set(result.rows.filter((row) => row.ok).map((row) => row.rowNumber)));
  }

  function toggleRow(rowNumber: number) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function toggleAll() {
    setChecked(allValidChecked ? new Set() : new Set(validRows.map((row) => row.rowNumber)));
  }

  async function handleConfirm() {
    if (!rows) return;
    const toImport = rows
      .filter((row) => row.ok && row.data && checked.has(row.rowNumber))
      .map((row) => row.data!);
    if (toImport.length === 0) return;

    setConfirming(true);
    const result = await confirmWalkInImport(toImport);
    setConfirming(false);

    if (result.failed.length === 0) {
      flash(`Recorded ${result.created} walk-in sale${result.created === 1 ? "" : "s"}.`);
      reset();
      return;
    }

    flash(
      `Recorded ${result.created}. ${result.failed.length} failed — check the rows below.`,
      "error",
    );
    setRows(
      result.failed.map(({ row, error }, index) => ({
        rowNumber: index + 1,
        raw: row,
        ok: false,
        error,
      })),
    );
    setChecked(new Set());
  }

  if (!open) return null;

  return (
    <div className="w-full lg:max-w-2xl lg:flex-1">
      <div className="flex flex-col gap-4 rounded-lg border border-ground/20 bg-ground/5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/admin/walk-in/template"
              className="text-sm font-semibold text-accent-2 underline"
            >
              Download template
            </a>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="text-sm text-ground/70 file:mr-3 file:rounded file:border-0 file:bg-ground/10 file:px-3 file:py-1.5 file:text-ground"
            />
            <button
              type="button"
              disabled={parsing}
              onClick={handleParse}
              className="rounded border border-ground/25 px-4 py-2 text-sm font-semibold hover:border-ground/50 disabled:opacity-50"
            >
              {parsing ? "Parsing…" : "Parse file"}
            </button>
          </div>

          {rows ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-ground/70">
                  {checked.size} of {validRows.length} ready to import
                </p>
                <button
                  type="button"
                  disabled={confirming || checked.size === 0}
                  onClick={handleConfirm}
                  className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {confirming
                    ? "Recording…"
                    : `Approve ${checked.size} ticket${checked.size === 1 ? "" : "s"}`}
                </button>
              </div>

              <Table>
                <thead>
                  <tr className="text-left">
                    <Th>
                      <input
                        type="checkbox"
                        checked={allValidChecked}
                        onChange={toggleAll}
                        disabled={validRows.length === 0}
                        aria-label="Select all valid rows"
                      />
                    </Th>
                    <Th>Row</Th>
                    <Th>Full name</Th>
                    <Th>Student ID</Th>
                    <Th>Year level</Th>
                    <Th>Section</Th>
                    <Th>Email</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <Tr key={row.rowNumber}>
                      <td className="py-2 pr-3 pl-4">
                        <input
                          type="checkbox"
                          checked={checked.has(row.rowNumber)}
                          disabled={!row.ok}
                          onChange={() => toggleRow(row.rowNumber)}
                          aria-label={`Include row ${row.rowNumber}`}
                        />
                      </td>
                      <td className="py-2 pr-3 text-ground/60">{row.rowNumber}</td>
                      <td className={`py-2 pr-3 ${row.ok ? "" : "text-ground/50"}`}>
                        {row.raw.fullName || "—"}
                      </td>
                      <td className={`py-2 pr-3 font-mono ${row.ok ? "" : "text-ground/50"}`}>
                        {row.raw.studentId || "—"}
                      </td>
                      <td className={`py-2 pr-3 ${row.ok ? "" : "text-ground/50"}`}>
                        {row.raw.yearLevel || "—"}
                      </td>
                      <td className={`py-2 pr-3 ${row.ok ? "" : "text-ground/50"}`}>
                        {row.raw.section || "—"}
                      </td>
                      <td className={`py-2 pr-3 ${row.ok ? "" : "text-ground/50"}`}>
                        {row.raw.email || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {row.ok ? (
                          <span className="text-green-400">Ready</span>
                        ) : (
                          <span className="text-red-300">{row.error}</span>
                        )}
                      </td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </>
          ) : null}

        <p className="text-xs text-ground/45">
          A row with a problem is excluded automatically — fix it in the
          spreadsheet and re-import rather than editing it here.
        </p>
      </div>
    </div>
  );
}
