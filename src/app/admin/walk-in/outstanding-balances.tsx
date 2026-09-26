"use client";

import { useState, useTransition } from "react";
import { Badge } from "../badge";
import { Modal } from "../modal";
import { Table, Th, Tr } from "../table";
import { useFlash } from "../flash";
import { formatPeso } from "@/lib/config/event";
import type { Registration } from "@/lib/supabase/types";
import { completeWalkInBalanceAction, sendPartialQrAction } from "./actions";

/**
 * Walk-ins still waiting on their remaining balance. Lives on /admin/walk-in
 * rather than the Dashboard because staff — who are the ones actually
 * taking this cash — can't reach Find a registration; see admin/layout.tsx's
 * staff allowlist. Sending a QR before the balance is paid is admin-only, so
 * staff see only "Mark balance paid".
 */
export function OutstandingBalances({
  registrations,
  recordedBy,
  isAdmin,
}: {
  registrations: Registration[];
  /** Registration id → name of whoever recorded the first payment. */
  recordedBy: Record<string, string | null>;
  isAdmin: boolean;
}) {
  if (registrations.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-3 font-display text-xl uppercase text-ground/90">
        Outstanding balances
      </h2>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Paid / Owed</Th>
            <Th>Recorded</Th>
            <Th className="last:pr-4">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {registrations.map((registration) => (
            <BalanceRow
              key={registration.id}
              registration={registration}
              recordedBy={recordedBy[registration.id] ?? null}
              isAdmin={isAdmin}
            />
          ))}
        </tbody>
      </Table>
    </section>
  );
}

function BalanceRow({
  registration,
  recordedBy,
  isAdmin,
}: {
  registration: Registration;
  recordedBy: string | null;
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [confirmingQr, setConfirmingQr] = useState(false);
  const flash = useFlash();
  const owed = registration.amount - registration.amount_paid;
  const hasQr = registration.ticket_code !== null;
  const qrEmailed = registration.ticket_email_sent_at !== null;

  function handleSendQr() {
    startTransition(async () => {
      const result = await sendPartialQrAction(registration.id);
      setConfirmingQr(false);
      if (!result.ok) {
        flash(result.error ?? "Something went wrong.", "error");
        return;
      }
      flash(
        hasQr
          ? `Re-sent the QR to ${registration.full_name}.`
          : `Sent ${registration.full_name} their QR — ${formatPeso(owed)} still owed.`,
      );
    });
  }

  function handleComplete() {
    startTransition(async () => {
      const result = await completeWalkInBalanceAction(registration.id);
      if (!result.ok) {
        flash(result.error ?? "Something went wrong.", "error");
        setConfirming(false);
        return;
      }
      setConfirming(false);
      flash(`Recorded the balance for ${registration.full_name} — ticket emailed.`);
    });
  }

  return (
    <Tr>
      <td className="py-2 pr-3 pl-4">
        <p className="font-semibold">{registration.full_name}</p>
        <p className="text-ground/60">
          {registration.year_level} · Section {registration.section} · {registration.email}
        </p>
        <p className="text-ground/60">ID: {registration.student_id}</p>
      </td>
      <td className="py-2 pr-3 whitespace-nowrap">
        <Badge tone="amber">Partial payment</Badge>{" "}
        {formatPeso(registration.amount_paid)} / {formatPeso(registration.amount)}
        {hasQr ? (
          <span
            className={`mt-1.5 flex items-center gap-1.5 font-sans text-xs ${qrEmailed ? "text-green-300" : "text-amber-300"}`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${qrEmailed ? "bg-green-400" : "bg-amber-400"}`}
            />
            {qrEmailed ? "QR sent" : "QR ready, not emailed"}
          </span>
        ) : null}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap text-ground/70">
        {new Date(registration.created_at).toLocaleString("en-PH")}
        <span className="block text-ground/90">by {recordedBy ?? "an organiser"}</span>
      </td>
      <td className="py-2 pl-3 pr-4 whitespace-nowrap">
        <div className="flex flex-col items-start gap-1.5">
          {isAdmin ? (
            <button
              type="button"
              disabled={pending}
              // No dialog to re-send a QR that already exists — it's the same
              // code and the same email. Only the first send lets someone in
              // on less than the full price, so only that one asks.
              onClick={hasQr ? handleSendQr : () => setConfirmingQr(true)}
              className="font-semibold text-accent-2 underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              {hasQr ? (qrEmailed ? "Resend QR" : "Send QR email") : "Send QR"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="font-semibold text-accent-2 underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
          >
            Mark balance paid
          </button>
        </div>

        {confirmingQr ? (
          <Modal
            title={`Send ${registration.full_name} their QR?`}
            onClose={() => {
              if (!pending) setConfirmingQr(false);
            }}
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ground/60">
                They can get in at the door with {formatPeso(owed)} still unpaid, and their
                certificate is held until the balance is paid. Only send this if that&apos;s
                been agreed.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleSendQr}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Sending…" : "Send QR"}
                </button>
                <button
                  type="button"
                  autoFocus
                  disabled={pending}
                  onClick={() => setConfirmingQr(false)}
                  className="text-sm font-semibold text-ground/60 hover:text-ground disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        ) : null}

        {confirming ? (
          <Modal
            title={`Collect ${formatPeso(owed)} from ${registration.full_name}?`}
            onClose={() => setConfirming(false)}
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ground/60">
                Only confirm once you have the remaining {formatPeso(owed)} in hand —{" "}
                {hasQr
                  ? "they're emailed a receipt and their certificate is released."
                  : "their QR is emailed immediately."}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleComplete}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Recording…" : "Confirm — balance paid"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-sm font-semibold text-ground/60 hover:text-ground"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        ) : null}
      </td>
    </Tr>
  );
}
