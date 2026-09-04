"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "../badge";
import { Table, Th, SortHeaderButton, Tr } from "../table";
import { formatPeso } from "@/lib/config/event";
import type { Registration } from "@/lib/supabase/types";
import {
  approveRegistration,
  rejectRegistration,
  type ActionResult,
} from "./actions";
import { ReceiptLightbox } from "./receipt-lightbox";

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
  const { full_name, email, gcash_reference, student_id } = row.registration;
  return (
    full_name.toLowerCase().includes(q) ||
    email.toLowerCase().includes(q) ||
    student_id.toLowerCase().includes(q) ||
    // Every row here is pending, which is always an online submission — but
    // the type is nullable now that walk-ins exist, so guard anyway.
    (gcash_reference ?? "").toLowerCase().includes(q)
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
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Pending</h2>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, student ID, or reference"
          aria-label="Search the review queue"
          className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none placeholder:text-ground/40 focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30"
        />
      </div>

      <div className="mt-2">
        <Table
          empty={
            visible.length === 0
              ? rows.length === 0
                ? "Nothing waiting. Every payment has been reviewed."
                : `Nothing matches “${query}”.`
              : undefined
          }
        >
          <thead>
            <tr className="text-left">
              <Th>Receipt</Th>
              {columns.map((col) => (
                <SortHeaderButton
                  key={col.key}
                  label={col.label}
                  onClick={() => toggleSort(col.key)}
                  active={sort.column === col.key}
                  direction={sort.direction}
                />
              ))}
              <Th>Reference</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <ReviewRow key={row.registration.id} row={row} />
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

function ReviewRow({ row }: { row: Row }) {
  const { registration, receiptUrl, duplicateCount } = row;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <Tr>
      <td className="py-2 pr-3 pl-4">
        {receiptUrl ? (
          <>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label={`View receipt submitted by ${registration.full_name}`}
              className="block rounded focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              {/* Signed Supabase URL, not a configured next/image host — plain img. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptUrl}
                alt={`Receipt submitted by ${registration.full_name}`}
                className="h-16 w-16 rounded border border-ground/15 object-cover"
              />
            </button>
            {lightboxOpen ? (
              <ReceiptLightbox
                src={receiptUrl}
                alt={`Receipt submitted by ${registration.full_name}`}
                onClose={() => setLightboxOpen(false)}
              />
            ) : null}
          </>
        ) : (
          <span className="text-ground/40">No receipt</span>
        )}
      </td>

      <td className="py-2 pr-3">
        <p className="font-semibold">{registration.full_name}</p>
        <p className="text-ground/60">
          {registration.year_level} · Section {registration.section}
        </p>
        <p className="text-ground/60">{registration.email}</p>
        <p className="text-ground/60">ID: {registration.student_id}</p>
      </td>

      <td className="py-2 pr-3 whitespace-nowrap">{formatPeso(registration.amount)}</td>

      <td className="py-2 pr-3 whitespace-nowrap text-ground/70">
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
            <p role="alert" className="text-xs font-medium text-red-300">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => approveRegistration(registration.id))}
              className="rounded-full bg-accent-2 px-3 py-1.5 text-xs font-semibold text-deep disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              Approve
            </button>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for rejecting"
              aria-label={`Reason for rejecting ${registration.full_name}`}
              className="w-40 rounded border border-ground/20 bg-ground/5 px-2 py-1.5 text-xs text-ground placeholder:text-ground/40 focus:border-accent-2 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            />
            <button
              type="button"
              disabled={pending || !reason.trim()}
              onClick={() => run(() => rejectRegistration(registration.id, reason))}
              className="rounded-full border border-red-400/60 px-3 py-1.5 text-xs font-semibold text-red-300 disabled:opacity-40 focus:outline-2 focus:outline-offset-2 focus:outline-red-400"
            >
              Reject
            </button>
          </div>
        </div>
      </td>
    </Tr>
  );
}
