"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "../badge";
import { formatPeso } from "@/lib/config/event";
import { formatTicketCode } from "@/lib/tickets/code";
import type { Registration } from "@/lib/supabase/types";
import { voidRegistration } from "./actions";

const STATUS_TONE = { approved: "green", pending: "amber", rejected: "red" } as const;

export function RegistrationRow({ registration }: { registration: Registration }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleVoid() {
    const reason = window.prompt(
      `Void ${registration.full_name}'s registration so they can submit again? ` +
        "This does not affect a ticket already scanned at the door. Give a " +
        "reason:",
    );
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
      setError("Give a reason.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await voidRegistration(registration.id, reason);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ground/10 bg-black/20 p-4">
      <div>
        <p className="font-semibold">{registration.full_name}</p>
        <p className="text-sm text-ground/60">
          {registration.year_level} · Section {registration.section} ·{" "}
          {registration.email}
        </p>
        <p className="text-sm text-ground/45">
          {formatPeso(registration.amount)} ·{" "}
          {registration.payment_method === "walk_in" ? (
            "walk-in"
          ) : (
            <>
              ref <span className="font-mono">{registration.gcash_reference}</span>
            </>
          )}
          {" · ID "}
          <span className="font-mono">{registration.student_id}</span>
        </p>
        {error ? (
          <p className="mt-1 text-sm font-medium text-accent">{error}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Badge tone={STATUS_TONE[registration.status]}>
          {registration.status}
        </Badge>
        {registration.ticket_code ? (
          <span className="font-mono text-sm">
            {formatTicketCode(registration.ticket_code)}
          </span>
        ) : null}
        <Link
          href={`/ticket/${registration.id}`}
          className="text-sm font-semibold text-accent-2 underline focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          Open ticket
        </Link>
        {registration.status !== "rejected" ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleVoid}
            className="text-sm font-semibold text-accent underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent"
          >
            Void
          </button>
        ) : null}
      </div>
    </li>
  );
}
