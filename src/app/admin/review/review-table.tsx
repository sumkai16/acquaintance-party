"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "../badge";
import { formatPeso } from "@/lib/config/event";
import type { Registration } from "@/lib/supabase/types";
import {
  approveRegistration,
  rejectRegistration,
  type ActionResult,
} from "./actions";

type Row = {
  registration: Registration;
  receiptUrl: string | null;
  duplicateCount: number;
};

type SortColumn = "name" | "amount" | "submitted";
type SortState = { column: SortColumn; direction: "asc" | "desc" };

function sortKey(row: Row, column: SortColumn): string | number {
  switch (column) {
    case "name":
      return row.registration.full_name.toLowerCase();
    case "amount":
      return row.registration.amount;
    case "submitted":
      return row.registration.created_at;
  }
}

function matches(row: Row, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { full_name, email, gcash_reference } = row.registration;
  return (
    full_name.toLowerCase().includes(q) ||
    email.toLowerCase().includes(q) ||
    gcash_reference.toLowerCase().includes(q)
  );
}

/**
 * Instant, client-side search and sort — deliberately not the dashboard's
 * URL-driven pattern. The pending queue self-limits (items leave the moment
 * they're decided), so the dataset stays small and an admin triaging it
 * wants as-you-type filtering, not a page reload per keystroke.
 *
 * `rows` stays a plain prop, never copied into state: approveRegistration/
 * rejectRegistration call revalidatePath, which re-fetches on the server and
 * flows a new `rows` prop down here. Deriving the rendered list from that
 * prop via useMemo is what lets an approved row disappear on its own, the
 * same way it already does today — copying it into local state would break
 * that.
 */
export function ReviewTable({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>({ column: "submitted", direction: "asc" });

  const visible = useMemo(() => {
    const filtered = rows.filter((row) => matches(row, query));
    const sorted = [...filtered].sort((a, b) => {
      const ka = sortKey(a, sort.column);
      const kb = sortKey(b, sort.column);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    return sort.direction === "asc" ? sorted : sorted.reverse();
  }, [rows, query, sort]);

  function toggleSort(column: SortColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  const columns: { key: SortColumn; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "amount", label: "Amount" },
    { key: "submitted", label: "Submitted" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name, email, or reference"
        aria-label="Search the review queue"
        className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[840px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="py-2 pr-3 pl-4">Receipt</th>
              {columns.map((col) => {
                const active = sort.column === col.key;
                const nextDir = active && sort.direction === "asc" ? "desc" : "asc";
                return (
                  <th key={col.key} className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      aria-label={`Sort by ${col.label}, ${nextDir}ending`}
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 focus:outline-2 focus:outline-offset-2 focus:outline-slate-500"
                    >
                      {col.label}
                      {active ? (
                        <span aria-hidden>{sort.direction === "asc" ? "↑" : "↓"}</span>
                      ) : null}
                    </button>
                  </th>
                );
              })}
              <th className="py-2 pr-3">Reference</th>
              <th className="py-2 pl-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <ReviewRow key={row.registration.id} row={row} />
            ))}
          </tbody>
        </table>

        {visible.length === 0 ? (
          <p className="px-4 py-6 text-slate-600">
            {rows.length === 0
              ? "Nothing waiting. Every payment has been reviewed."
              : `Nothing matches “${query}”.`}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ReviewRow({ row }: { row: Row }) {
  const { registration, receiptUrl, duplicateCount } = row;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <tr className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50">
      <td className="py-2 pr-3 pl-4">
        {receiptUrl ? (
          <a href={receiptUrl} target="_blank" rel="noreferrer">
            {/* Signed Supabase URL, not a configured next/image host — plain img. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptUrl}
              alt={`Receipt submitted by ${registration.full_name}`}
              className="h-16 w-16 rounded border border-slate-200 object-cover"
            />
          </a>
        ) : (
          <span className="text-slate-400">No receipt</span>
        )}
      </td>

      <td className="py-2 pr-3">
        <p className="font-semibold">{registration.full_name}</p>
        <p className="text-slate-500">
          {registration.year_level} · Section {registration.section}
        </p>
        <p className="text-slate-500">{registration.email}</p>
      </td>

      <td className="py-2 pr-3 whitespace-nowrap">{formatPeso(registration.amount)}</td>

      <td className="py-2 pr-3 whitespace-nowrap">
        {new Date(registration.created_at).toLocaleString("en-PH")}
      </td>

      <td className="py-2 pr-3">
        <span className="font-mono">{registration.gcash_reference}</span>
        {duplicateCount > 1 ? (
          <span
            className="ml-2 inline-block"
            title={`This reference appears on ${duplicateCount} registrations — check the GCash transaction history before approving.`}
          >
            <Badge tone="red">Duplicate ×{duplicateCount}</Badge>
          </span>
        ) : null}
      </td>

      <td className="py-2 pl-3">
        <div className="flex flex-col gap-2">
          {error ? (
            <p role="alert" className="text-xs font-medium text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => approveRegistration(registration.id))}
              className="rounded bg-green-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-green-800"
            >
              Approve
            </button>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for rejecting"
              aria-label={`Reason for rejecting ${registration.full_name}`}
              className="w-40 rounded border border-slate-300 px-2 py-1.5 text-xs focus:border-slate-500 focus:outline-2 focus:outline-offset-2 focus:outline-slate-500"
            />
            <button
              type="button"
              disabled={pending || !reason.trim()}
              onClick={() => run(() => rejectRegistration(registration.id, reason))}
              className="rounded border border-red-800 px-3 py-1.5 text-xs font-semibold text-red-800 disabled:opacity-40 focus:outline-2 focus:outline-offset-2 focus:outline-red-800"
            >
              Reject
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
