"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPeso } from "@/lib/config/event";
import type { ExpenseImportRow } from "@/lib/expenses/import-rows";
import { Table, Th, Tr } from "../table";
import { useFlash } from "../flash";
import { confirmExpenseImport, parseExpenseImport } from "./import-actions";

export function ImportPanel({
  remainingCashCentavos,
  remainingGcashCentavos,
  onClose,
}: {
  remainingCashCentavos: number;
  remainingGcashCentavos: number;
  onClose: () => void;
}) {
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rows, setRows] = useState<ExpenseImportRow[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const flash = useFlash();

  const validRows = rows?.filter((row) => row.ok) ?? [];
  const selected = validRows.filter((row) => checked.has(row.rowNumber));
  const allValidChecked = validRows.length > 0 && selected.length === validRows.length;

  const cashTotal = selected
    .filter((row) => row.data!.method === "cash")
    .reduce((sum, row) => sum + row.data!.amountCentavos, 0);
  const gcashTotal = selected
    .filter((row) => row.data!.method === "gcash")
    .reduce((sum, row) => sum + row.data!.amountCentavos, 0);
  const cashOver = cashTotal > remainingCashCentavos;
  const gcashOver = gcashTotal > remainingGcashCentavos;

  async function handleParse() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      flash("Choose a file first.", "error");
      return;
    }
    setParsing(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await parseExpenseImport(formData);
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
    if (selected.length === 0) return;
    setConfirming(true);
    const result = await confirmExpenseImport(selected.map((row) => row.data!));
    setConfirming(false);

    if (result.error) {
      flash(result.error, "error");
      return;
    }
    router.refresh();
    if (result.failed.length === 0) {
      flash(`Imported ${result.created} expense${result.created === 1 ? "" : "s"}.`);
      onClose();
      return;
    }
    flash(`Imported ${result.created}. ${result.failed.length} failed — see below.`, "error");
    const failedKeys = new Set(result.failed.map(({ data }) => JSON.stringify(data)));
    setRows(
      selected
        .filter((row) => failedKeys.has(JSON.stringify(row.data)))
        .map((row) => ({ ...row, ok: false, error: "Could not be saved. Try again." })),
    );
    setChecked(new Set());
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-ground/20 bg-ground/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl uppercase">Import from Excel</h2>
        <button type="button" onClick={onClose} className="text-sm text-ground/70">
          Close
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/admin/expenses/template"
          className="text-sm font-semibold text-accent-2 underline"
        >
          Download template
        </a>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="max-w-full text-sm text-ground/70 file:mr-3 file:rounded file:border-0 file:bg-ground/10 file:px-3 file:py-1.5 file:text-ground"
        />
        <button
          type="button"
          disabled={parsing}
          onClick={handleParse}
          className="rounded border border-ground/25 px-4 py-2 text-sm font-semibold hover:border-ground/50 disabled:opacity-50"
        >
          {parsing ? "Reading…" : "Parse file"}
        </button>
      </div>

      {rows ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ground/70">
              {selected.length} of {validRows.length} ready — {formatPeso(cashTotal)} cash,{" "}
              {formatPeso(gcashTotal)} GCash
            </p>
            <button
              type="button"
              disabled={confirming || selected.length === 0}
              onClick={handleConfirm}
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {confirming
                ? "Importing…"
                : `Import ${selected.length} expense${selected.length === 1 ? "" : "s"}`}
            </button>
          </div>

          {cashOver || gcashOver ? (
            <p className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              This import is more than what&rsquo;s left
              {cashOver ? ` in cash (${formatPeso(remainingCashCentavos)})` : ""}
              {cashOver && gcashOver ? " and" : ""}
              {gcashOver ? ` in GCash (${formatPeso(remainingGcashCentavos)})` : ""}. It will
              still save, and the card will go negative.
            </p>
          ) : null}

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
                <Th>Item</Th>
                <Th>Amount</Th>
                <Th>Method</Th>
                <Th>Date &amp; time</Th>
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
                  <td className={`py-2 pr-3 ${row.ok ? "" : "text-ground/50"}`}>{row.raw.item || "—"}</td>
                  <td className={`py-2 pr-3 tabular-nums ${row.ok ? "" : "text-ground/50"}`}>
                    {row.data ? formatPeso(row.data.amountCentavos) : row.raw.amount || "—"}
                  </td>
                  <td className={`py-2 pr-3 ${row.ok ? "" : "text-ground/50"}`}>
                    {row.data ? (row.data.method === "cash" ? "Cash" : "GCash") : row.raw.method || "—"}
                  </td>
                  <td className={`py-2 pr-3 ${row.ok ? "" : "text-ground/50"}`}>{row.raw.date || "—"}</td>
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
        Rows with a problem are left out. Fix them in the spreadsheet and import again. Imported
        expenses are recorded under your name, without receipt photos.
      </p>
    </div>
  );
}
