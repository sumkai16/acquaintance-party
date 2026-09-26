"use client";

import { useState, useTransition } from "react";
import { useFlash } from "../flash";
import { Modal } from "../modal";
import { togglePaymentsOpen } from "./actions";

/**
 * The Dashboard's payment-line switch, sitting in the page header. Flipping
 * it changes the public checkout for every student at once, so the switch
 * only ever asks: it stays on the current state until the confirmation
 * dialog is accepted, and the dialog says exactly what will change.
 * Same useTransition + flash pattern as send-receipt-emails.tsx.
 */
export function PaymentLineToggle({ open }: { open: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [isSaving, startTransition] = useTransition();
  const flash = useFlash();
  const next = !open;

  function confirm() {
    startTransition(async () => {
      const result = await togglePaymentsOpen(next);
      setConfirming(false);
      if (!result.ok) {
        flash(result.error ?? "Couldn't save that change.", "error");
        return;
      }
      flash(next ? "Online payments reopened." : "Online payments closed.");
    });
  }

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-full border border-ground/15 bg-ground/5 py-1.5 pr-2 pl-3.5">
        <span className="text-sm font-semibold">Online payments</span>
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${open ? "text-green-300" : "text-red-300"}`}
        >
          {open ? "Open" : "Closed"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label="Online payments"
          onClick={() => setConfirming(true)}
          disabled={isSaving}
          className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 ${open ? "bg-green-500/70" : "bg-ground/25"}`}
        >
          <span
            aria-hidden
            className={`absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-ground transition-transform ${open ? "translate-x-4" : ""}`}
          />
        </button>
      </div>

      {confirming ? (
        <Modal
          title={open ? "Close online payments?" : "Reopen online payments?"}
          onClose={() => {
            if (!isSaving) setConfirming(false);
          }}
        >
          <p className="text-sm text-ground/70">
            {open
              ? "Students will no longer be able to submit GCash payments. The landing page and checkout show “Payments are closed” right away. Walk-in sales are not affected."
              : "Students will be able to submit GCash payments again. The landing page and checkout go live right away."}{" "}
            You can change this back at any time.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={confirm}
              disabled={isSaving}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              {isSaving ? "Saving…" : open ? "Close payments" : "Reopen payments"}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => setConfirming(false)}
              disabled={isSaving}
              className="text-sm font-semibold text-ground/60 hover:text-ground disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
