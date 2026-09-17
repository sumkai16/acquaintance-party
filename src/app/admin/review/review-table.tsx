"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "../badge";
import { Table, Th, SortHeaderButton, Tr } from "../table";
import { useFlash } from "../flash";
import { Option } from "../option";
import { formatPeso } from "@/lib/config/event";
import { YEAR_LEVELS } from "@/lib/registrations/schema";
import { formatTicketCode } from "@/lib/tickets/code";
import type { Registration, ReviewStatus } from "@/lib/supabase/types";
import {
  approveRegistration,
  rejectRegistration,
  type ActionResult,
} from "./actions";
import { ReceiptLightbox } from "../receipt-lightbox";

type Row = {
  registration: Registration;
  receiptUrl: string | null;
  duplicateCount: number;
  reviewerEmail: string | null;
};

type SortColumn = "name" | "amount" | "submitted";
type SortState = { column: SortColumn; direction: "asc" | "desc" };

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const EMPTY_TEXT: Record<ReviewStatus, string> = {
  pending: "Nothing waiting. Every payment has been reviewed.",
  approved: "No payments approved yet.",
  rejected: "No payments rejected.",
};

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
    // Every row here is an online submission — but the type is nullable now
    // that walk-ins exist, so guard anyway.
    (gcash_reference ?? "").toLowerCase().includes(q)
  );
}

/**
 * Instant, client-side search and sort — deliberately not the dashboard's
 * URL-driven pattern. An admin triaging the queue wants as-you-type
 * filtering, not a page reload per keystroke. Only the status lives in the
 * URL: it decides which rows the server fetches, so Approved's hundreds of
 * rows never load while someone is working the Pending queue.
 *
 * `rows` stays a plain prop, never copied into state: approveRegistration/
 * rejectRegistration call revalidatePath, which re-fetches on the server and
 * flows a new `rows` prop down here. Deriving the rendered list from that
 * prop via useMemo is what lets an approved row leave the Pending list on its
 * own — copying it into local state would break that.
 */
export function ReviewTable({
  rows,
  status,
  counts,
}: {
  rows: Row[];
  status: ReviewStatus;
  counts: Record<ReviewStatus, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [switching, startSwitch] = useTransition();
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [sort, setSort] = useState<SortState>({ column: "submitted", direction: "asc" });

  const visible = useMemo(() => {
    const filtered = rows.filter(
      (row) => matches(row, query) && (!year || row.registration.year_level === year),
    );
    const sorted = [...filtered].sort((a, b) => {
      const ka = sortKey(a, sort.column);
      const kb = sortKey(b, sort.column);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    return sort.direction === "asc" ? sorted : sorted.reverse();
  }, [rows, query, year, sort]);

  function toggleSort(column: SortColumn) {
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  function changeStatus(next: string) {
    // Pending is the default, so it gets the bare URL.
    startSwitch(() => {
      router.push(next === "pending" ? pathname : `${pathname}?status=${next}`);
    });
  }

  const columns: { key: SortColumn; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "amount", label: "Amount" },
    { key: "submitted", label: "Submitted" },
  ];

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{STATUS_LABELS[status]}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, student ID, or reference"
            aria-label="Search payments"
            className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none placeholder:text-ground/40 focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30"
          />
          <select
            value={status}
            onChange={(event) => changeStatus(event.target.value)}
            aria-label="Filter by status"
            className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30 [color-scheme:dark]"
          >
            {(Object.keys(STATUS_LABELS) as ReviewStatus[]).map((value) => (
              <Option key={value} value={value}>
                {`${STATUS_LABELS[value]} (${counts[value]})`}
              </Option>
            ))}
          </select>
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
            aria-label="Filter by year level"
            className="rounded-md border border-ground/20 bg-ground/5 px-3 py-2 text-sm text-ground outline-none focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30 [color-scheme:dark]"
          >
            <Option value="">All year levels</Option>
            {YEAR_LEVELS.map((level) => (
              <Option key={level} value={level}>
                {level}
              </Option>
            ))}
          </select>
        </div>
      </div>

      <div className={`mt-2 transition-opacity ${switching ? "opacity-50" : ""}`}>
        <Table
          empty={
            visible.length === 0
              ? rows.length === 0
                ? EMPTY_TEXT[status]
                : query
                  ? `Nothing matches “${query}”.`
                  : "Nothing matches this filter."
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
              <Th>{status === "pending" ? "Actions" : "Decision"}</Th>
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
  const [lightboxOpen, setLightboxOpen] = useState(false);

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
                // The Approved list can run to hundreds of receipts.
                loading="lazy"
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
        {registration.status === "pending" ? (
          <ReviewActions registration={registration} />
        ) : (
          <Decision registration={registration} reviewerEmail={row.reviewerEmail} />
        )}
      </td>
    </Tr>
  );
}

function ReviewActions({ registration }: { registration: Registration }) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const flash = useFlash();

  function run(action: () => Promise<ActionResult>, successText: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        flash(result.error ?? "Something went wrong.", "error");
        return;
      }
      flash(successText);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(
            () => approveRegistration(registration.id),
            `Approved — ticket emailed to ${registration.full_name}.`,
          )
        }
        className="rounded-full bg-accent-2 px-3 py-1.5 text-xs font-semibold text-deep disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      >
        Approve
      </button>
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason for rejecting"
        maxLength={300}
        aria-label={`Reason for rejecting ${registration.full_name}`}
        className="w-40 rounded border border-ground/20 bg-ground/5 px-2 py-1.5 text-xs text-ground placeholder:text-ground/40 focus:border-accent-2 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      />
      <button
        type="button"
        disabled={pending || !reason.trim()}
        onClick={() =>
          run(
            () => rejectRegistration(registration.id, reason),
            `Rejected ${registration.full_name}'s registration.`,
          )
        }
        className="rounded-full border border-red-400/60 px-3 py-1.5 text-xs font-semibold text-red-300 disabled:opacity-40 focus:outline-2 focus:outline-offset-2 focus:outline-red-400"
      >
        Reject
      </button>
    </div>
  );
}

/**
 * Read-only on purpose. Undoing an approval frees the student ID and can
 * strand a ticket already in someone's inbox, so it stays on the Dashboard's
 * Void, which says so.
 */
function Decision({
  registration,
  reviewerEmail,
}: {
  registration: Registration;
  reviewerEmail: string | null;
}) {
  const approved = registration.status === "approved";
  const when = registration.reviewed_at
    ? ` on ${new Date(registration.reviewed_at).toLocaleString("en-PH")}`
    : "";

  return (
    <div className="max-w-xs">
      <Badge tone={approved ? "green" : "red"}>{approved ? "Approved" : "Rejected"}</Badge>
      <p className="mt-1 text-ground/60">
        {approved ? "Approved" : "Rejected"} by {reviewerEmail ?? "an admin"}
        {when}
      </p>
      {approved && registration.ticket_code ? (
        <p className="font-mono text-ground/60">
          {formatTicketCode(registration.ticket_code)}
        </p>
      ) : null}
      {!approved && registration.reject_reason ? (
        <p className="text-ground/60">“{registration.reject_reason}”</p>
      ) : null}
    </div>
  );
}
