"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "../badge";
import { Tr } from "../table";
import { useFlash } from "../flash";
import { formatPeso } from "@/lib/config/event";
import { formatTicketCode } from "@/lib/tickets/code";
import type { Registration } from "@/lib/supabase/types";
import { sendTicketEmail, voidRegistration } from "./actions";

const STATUS_TONE = { approved: "green", pending: "amber", rejected: "red" } as const;

export function RegistrationRow({
  registration,
  reviewerEmail,
  addedByName,
}: {
  registration: Registration;
  reviewerEmail: string | null;
  addedByName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const flash = useFlash();

  function handleEmail() {
    startTransition(async () => {
      const result = await sendTicketEmail(registration.id);
      if (!result.ok) {
        flash(result.error ?? "Something went wrong.", "error");
        return;
      }
      flash(`Emailed the QR to ${registration.email}.`);
    });
  }

  function handleVoid() {
    startTransition(async () => {
      const result = await voidRegistration(registration.id, reason);
      if (!result.ok) {
        flash(result.error ?? "Something went wrong.", "error");
        return;
      }
      setReason("");
      flash(`Voided ${registration.full_name}'s registration.`);
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

      <td className="py-2 pr-3 whitespace-nowrap text-ground/70">{addedByName ?? "—"}</td>

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
          {registration.status === "approved" ? (
            <button
              type="button"
              disabled={pending}
              onClick={handleEmail}
              // Works on someone already emailed on purpose — this is the
              // answer to "it went to spam" / "I mistyped my address."
              title={
                registration.ticket_email_sent_at
                  ? `Last sent ${new Date(registration.ticket_email_sent_at).toLocaleString("en-PH")}. Sends again.`
                  : "Not emailed yet. Sends the QR to their address."
              }
              className="font-semibold text-accent-2 underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              {registration.ticket_email_sent_at ? "Resend QR" : "Email QR"}
            </button>
          ) : null}
          {registration.status !== "rejected" ? (
            <>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason for voiding"
                maxLength={300}
                aria-label={`Reason for voiding ${registration.full_name}'s registration`}
                className="w-36 rounded border border-ground/20 bg-ground/5 px-2 py-1.5 text-xs text-ground placeholder:text-ground/40 focus:border-accent-2 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
              />
              <button
                type="button"
                disabled={pending || !reason.trim()}
                onClick={handleVoid}
                title="Lets them submit again. Does not affect a ticket already scanned at the door."
                className="font-semibold text-accent underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent"
              >
                Void
              </button>
            </>
          ) : null}
        </div>
      </td>
    </Tr>
  );
}
