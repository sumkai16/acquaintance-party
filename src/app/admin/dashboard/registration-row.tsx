"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "../badge";
import { Modal } from "../modal";
import { Tr } from "../table";
import { useFlash } from "../flash";
import { formatPeso } from "@/lib/config/event";
import { formatTicketCode } from "@/lib/tickets/code";
import type { Registration } from "@/lib/supabase/types";
import { ReceiptLightbox } from "../receipt-lightbox";
import { sendTicketEmail, voidRegistration } from "./actions";
import { EditRegistration } from "./edit-registration";

const STATUS_TONE = { approved: "green", pending: "amber", rejected: "red" } as const;

export function RegistrationRow({
  registration,
  reviewerEmail,
  addedByName,
  receiptUrl,
}: {
  registration: Registration;
  reviewerEmail: string | null;
  addedByName: string | null;
  receiptUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
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
      setVoidOpen(false);
      flash(`Voided ${registration.full_name}'s registration.`);
    });
  }

  return (
    <Tr>
      <td className="py-2 pr-3 pl-4">
        {editing ? (
          <EditRegistration
            registration={registration}
            onDone={() => setEditing(false)}
          />
        ) : (
          <>
            <p className="font-semibold">{registration.full_name}</p>
            <p className="text-ground/60">
              {registration.year_level} · Section {registration.section} ·{" "}
              {registration.email}
            </p>
            <p className="text-ground/60">ID: {registration.student_id}</p>
          </>
        )}
      </td>

      <td className="py-2 pr-3 whitespace-nowrap">{formatPeso(registration.amount)}</td>

      <td className="py-2 pr-3">
        {registration.payment_method === "walk_in" ? (
          "walk-in"
        ) : (
          <>
            <span className="font-mono">{registration.gcash_reference}</span>
            {receiptUrl ? (
              <button
                type="button"
                onClick={() => setReceiptOpen(true)}
                className="mt-1 block font-semibold text-accent-2 underline focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
              >
                View receipt
              </button>
            ) : (
              <p className="mt-1 text-ground/40">No receipt</p>
            )}
            {receiptOpen && receiptUrl ? (
              <ReceiptLightbox
                src={receiptUrl}
                alt={`Receipt submitted by ${registration.full_name}`}
                onClose={() => setReceiptOpen(false)}
              />
            ) : null}
          </>
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

      <td className="py-2 pl-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            disabled={pending || editing}
            onClick={() => setEditing(true)}
            title="Correct a mistyped name, student ID, year, section or email. Amount and status are not editable."
            className="font-semibold text-accent-2 underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
          >
            Edit
          </button>
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
            <button
              type="button"
              disabled={pending}
              onClick={() => setVoidOpen(true)}
              title="Lets them submit again. Does not affect a ticket already scanned at the door."
              className="font-semibold text-accent underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent"
            >
              Void
            </button>
          ) : null}
        </div>

        {voidOpen ? (
          <VoidModal
            fullName={registration.full_name}
            reason={reason}
            onReasonChange={setReason}
            pending={pending}
            onClose={() => setVoidOpen(false)}
            onConfirm={handleVoid}
          />
        ) : null}
      </td>
    </Tr>
  );
}

function VoidModal({
  fullName,
  reason,
  onReasonChange,
  pending,
  onClose,
  onConfirm,
}: {
  fullName: string;
  reason: string;
  onReasonChange: (value: string) => void;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={`Void ${fullName}'s registration`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
        className="flex flex-col gap-3"
      >
        <p className="text-sm text-ground/60">
          Lets them submit again. Does not affect a ticket already scanned at
          the door.
        </p>
        <textarea
          autoFocus
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Reason for voiding"
          maxLength={300}
          rows={3}
          aria-label={`Reason for voiding ${fullName}'s registration`}
          className="rounded border border-ground/25 bg-deep px-3 py-2 text-sm placeholder:text-ground/40 focus:border-accent-3 focus:outline-2 focus:outline-offset-2 focus:outline-accent-3"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || !reason.trim()}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Voiding…" : "Void registration"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-ground/60 hover:text-ground"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
