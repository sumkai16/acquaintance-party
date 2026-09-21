"use client";

import { useState, useTransition } from "react";
import { Badge } from "../badge";
import { Modal } from "../modal";
import {
  ArrowRightIcon,
  EyeIcon,
  IconActionButton,
  IconActionLink,
  MailIcon,
  PencilIcon,
  TrashIcon,
} from "../icon-action";
import { Tr } from "../table";
import { useFlash } from "../flash";
import { formatPeso } from "@/lib/config/event";
import { formatTicketCode } from "@/lib/tickets/code";
import type { Registration } from "@/lib/supabase/types";
import type { RowReceipt } from "@/lib/receipts/queries";
import { ReceiptLightbox } from "../receipt-lightbox";
import { sendTicketEmail, voidRegistration } from "./actions";
import { EditRegistration } from "./edit-registration";

const STATUS_TONE = {
  approved: "green",
  pending: "amber",
  rejected: "red",
  partial: "amber",
} as const;

export const STATUS_LABEL = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  partial: "Partial payment",
} as const;

export function RegistrationRow({
  registration,
  reviewerEmail,
  addedByName,
  receiptUrl,
  receipts,
}: {
  registration: Registration;
  reviewerEmail: string | null;
  addedByName: string | null;
  /** The GCash proof they uploaded at checkout — not the acknowledgement receipt. */
  receiptUrl: string | null;
  /** Acknowledgement receipts issued for this registration's payments. */
  receipts: RowReceipt[];
}) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const flash = useFlash();

  const rejectionNote =
    `Rejected by ${reviewerEmail ?? "an admin"}` +
    (registration.reviewed_at
      ? ` on ${new Date(registration.reviewed_at).toLocaleString("en-PH")}`
      : "") +
    (registration.reject_reason ? ` — ${registration.reject_reason}` : "");

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

      <td className="py-2 pr-3 whitespace-nowrap">
        {registration.status === "partial"
          ? `${formatPeso(registration.amount_paid)} / ${formatPeso(registration.amount)}`
          : formatPeso(registration.amount)}
      </td>

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
          {STATUS_LABEL[registration.status]}
        </Badge>
        {registration.status === "rejected" ? (
          // Capped and clamped: this is the longest wrappable text in the
          // table, so left to grow it takes every spare pixel the layout has
          // and opens a gap beside Ticket code on every other row. The full
          // text stays available on hover.
          <p
            title={rejectionNote}
            className="mt-1 line-clamp-2 max-w-52 text-ground/50"
          >
            {rejectionNote}
          </p>
        ) : null}
      </td>

      <td className="py-2 pr-3 whitespace-nowrap">
        <span className="font-mono">
          {registration.ticket_code ? formatTicketCode(registration.ticket_code) : "—"}
        </span>
        <DeliveryMarkers registration={registration} receipts={receipts} />
      </td>

      <td className="py-2 pl-3">
        {/* Every action is always visible, tinted by what it does — neutral to
            go look, blue to edit, gold to send, clay to destroy — rather than
            hidden behind a menu that took two clicks to reach. */}
        <div className="flex items-center justify-end gap-[7px]">
          <IconActionLink
            label="Ticket"
            href={`/ticket/${registration.id}`}
            icon={ArrowRightIcon}
          />
          {receipts.map((receipt, index) => (
            <IconActionLink
              key={receipt.id}
              label={`View receipt${receipts.length > 1 ? ` ${index + 1}` : ""}`}
              href={`/receipt/${receipt.id}`}
              newTab
              icon={EyeIcon}
            />
          ))}
          <IconActionButton
            label="Edit details"
            tone="blue"
            icon={PencilIcon}
            disabled={pending || editing}
            onClick={() => setEditing(true)}
          />
          {registration.status === "approved" ? (
            <IconActionButton
              // Works on someone already emailed on purpose — this is the
              // answer to "it went to spam" / "I mistyped my address."
              label={registration.ticket_email_sent_at ? "Resend QR email" : "Email QR"}
              tone="gold"
              icon={MailIcon}
              disabled={pending}
              onClick={handleEmail}
            />
          ) : null}
          {registration.status !== "rejected" ? (
            <IconActionButton
              label="Void ticket"
              tone="clay"
              icon={TrashIcon}
              disabled={pending}
              onClick={() => setVoidOpen(true)}
            />
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

/**
 * Whether this student has actually been emailed their QR and receipt — the
 * row-level view of what the Receipts card counts. A voided ticket shows
 * nothing (nobody is emailing it), and a pending one has neither yet.
 * A partial payer has no QR to send until paid in full, so only their
 * receipt is shown.
 */
function DeliveryMarkers({
  registration,
  receipts,
}: {
  registration: Registration;
  receipts: RowReceipt[];
}) {
  if (registration.status === "rejected" || registration.status === "pending") return null;

  const qrSent = Boolean(registration.ticket_email_sent_at);
  const receiptSent = receipts.length > 0 && receipts.every((receipt) => receipt.emailed);

  if (registration.email_bounced_at) {
    return (
      <div className="mt-1.5 flex flex-col gap-0.5 font-sans text-xs">
        <span
          title={`Resend reported a bounce on ${new Date(registration.email_bounced_at).toLocaleString("en-PH")}. Edit the email, then resend.`}
          className="flex items-center gap-1.5 text-red-300"
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red-400" />
          Email bounced — fix the address
        </span>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex flex-col gap-0.5 font-sans text-xs">
      {registration.status === "approved" ? (
        <Marker sent={qrSent}>{qrSent ? "QR sent" : "QR not sent"}</Marker>
      ) : null}
      <Marker sent={receiptSent}>{receiptSent ? "Receipt sent" : "Receipt not sent"}</Marker>
    </div>
  );
}

function Marker({ sent, children }: { sent: boolean; children: React.ReactNode }) {
  return (
    <span className={`flex items-center gap-1.5 ${sent ? "text-green-300" : "text-amber-300"}`}>
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${sent ? "bg-green-400" : "bg-amber-400"}`}
      />
      {children}
    </span>
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
