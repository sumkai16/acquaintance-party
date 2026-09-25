"use client";

import { useTransition } from "react";
import { useFlash } from "../flash";
import { togglePaymentsOpen } from "./actions";

/**
 * The Dashboard's payment-line switch. One click flips the public
 * checkout for everyone — the copy spells out what each state means (and
 * that walk-in sales are untouched) so nobody has to guess what
 * "Closed" does. Built on the same useTransition + flash pattern as
 * send-receipt-emails.tsx.
 */
export function PaymentLineToggle({ open }: { open: boolean }) {
  const [isSaving, startTransition] = useTransition();
  const flash = useFlash();

  function flip() {
    const next = !open;
    startTransition(async () => {
      const result = await togglePaymentsOpen(next);
      if (!result.ok) {
        flash(result.error ?? "Couldn't save that change.", "error");
        return;
      }
      flash(next ? "Online payments reopened." : "Online payments closed.");
    });
  }

  return (
    <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ground/10 bg-ground/5 px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold">Online payments</h2>
        <p className="text-sm text-ground/70">
          {open
            ? "The GCash checkout is open — students can submit new payments."
            : "The GCash checkout is closed. No new online payments are accepted; walk-in sales are unaffected."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
            open
              ? "border-green-500/40 text-green-400"
              : "border-red-500/40 text-red-400"
          }`}
        >
          {open ? "Open" : "Closed"}
        </span>
        <button
          type="button"
          onClick={flip}
          disabled={isSaving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          {isSaving ? "Saving…" : open ? "Close payments" : "Reopen payments"}
        </button>
      </div>
    </section>
  );
}
