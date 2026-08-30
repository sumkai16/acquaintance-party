"use client";

import { useState, useTransition } from "react";
import { formatPeso } from "@/lib/config/event";
import type { Registration } from "@/lib/supabase/types";
import {
  approveRegistration,
  rejectRegistration,
  type ActionResult,
} from "./actions";

export function ReviewCard({
  registration,
  receiptUrl,
  duplicateCount,
}: {
  registration: Registration;
  receiptUrl: string | null;
  duplicateCount: number;
}) {
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
    <article className="grid gap-5 rounded border border-ink/20 bg-white p-5 md:grid-cols-[280px_1fr]">
      {receiptUrl ? (
        <a href={receiptUrl} target="_blank" rel="noreferrer">
          {/* Signed Supabase URL, not a configured next/image host — plain img. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receiptUrl}
            alt={`Receipt submitted by ${registration.full_name}`}
            className="w-full rounded border border-ink/15"
          />
        </a>
      ) : (
        <p className="text-sm text-ink/60">Receipt image unavailable.</p>
      )}

      <div className="flex flex-col gap-3">
        {duplicateCount > 1 ? (
          <p className="rounded bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">
            This reference number appears on {duplicateCount} registrations.
            Check the GCash transaction history before approving.
          </p>
        ) : null}

        <div>
          <h2 className="text-xl font-bold">{registration.full_name}</h2>
          <p className="text-ink/70">
            {registration.year_level} · Section {registration.section}
          </p>
          <p className="text-ink/70">{registration.email}</p>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-ink/60">Reference</dt>
          <dd className="font-mono">{registration.gcash_reference}</dd>
          <dt className="text-ink/60">Amount</dt>
          <dd>{formatPeso(registration.amount)}</dd>
          <dt className="text-ink/60">Submitted</dt>
          <dd>{new Date(registration.created_at).toLocaleString("en-PH")}</dd>
        </dl>

        {error ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveRegistration(registration.id))}
            className="rounded bg-green-800 px-5 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            Approve
          </button>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for rejecting"
            aria-label="Reason for rejecting"
            className="min-w-52 flex-1 rounded border border-ink/25 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || !reason.trim()}
            onClick={() => run(() => rejectRegistration(registration.id, reason))}
            className="rounded border border-red-800 px-5 py-2.5 font-semibold text-red-800 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      </div>
    </article>
  );
}
