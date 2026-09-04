"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "../badge";
import { Tr } from "../table";
import { formatPeso } from "@/lib/config/event";
import { formatTicketCode } from "@/lib/tickets/code";
import type { Registration } from "@/lib/supabase/types";
import { voidRegistration } from "./actions";

const STATUS_TONE = { approved: "green", pending: "amber", rejected: "red" } as const;

export function RegistrationRow({
  registration,
  reviewerEmail,
}: {
  registration: Registration;
  reviewerEmail: string | null;
}) {
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
    <Tr>
      <td className="py-2 pr-3 pl-4">
        <p className="font-semibold">{registration.full_name}</p>
        <p className="text-ground/60">
          {registration.year_level} · Section {registration.section} ·{" "}
          {registration.email}
        </p>
        <p className="text-ground/60">ID: {registration.student_id}</p>
      </td>

      <td className="py-2 pr-3 whitespace-nowrap">{formatPeso(registration.amount)}</td>

      <td className="py-2 pr-3">
        {registration.payment_method === "walk_in" ? (
          "walk-in"
        ) : (
          <span className="font-mono">{registration.gcash_reference}</span>
        )}
      </td>

      <td className="py-2 pr-3 whitespace-nowrap text-ground/70">
        {new Date(registration.created_at).toLocaleString("en-PH")}
      </td>

      <td className="py-2 pr-3">
        <Badge tone={STATUS_TONE[registration.status]}>
          {registration.status}
        </Badge>
        {registration.status === "rejected" ? (
          <p className="mt-1 text-ground/50">
            Rejected by {reviewerEmail ?? "an admin"}
            {registration.reviewed_at
              ? ` on ${new Date(registration.reviewed_at).toLocaleString("en-PH")}`
              : ""}
            {registration.reject_reason ? ` — ${registration.reject_reason}` : ""}
          </p>
        ) : null}
        {error ? (
          <p className="mt-1 font-medium text-accent">{error}</p>
        ) : null}
      </td>

      <td className="py-2 pr-3 font-mono whitespace-nowrap">
        {registration.ticket_code ? formatTicketCode(registration.ticket_code) : "—"}
      </td>

      <td className="py-2 pl-3 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <Link
            href={`/ticket/${registration.id}`}
            className="font-semibold text-accent-2 underline focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
          >
            Open ticket
          </Link>
          {registration.status !== "rejected" ? (
            <button
              type="button"
              disabled={pending}
              onClick={handleVoid}
              className="font-semibold text-accent underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent"
            >
              Void
            </button>
          ) : null}
        </div>
      </td>
    </Tr>
  );
}
