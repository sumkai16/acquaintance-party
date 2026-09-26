"use client";

import { useTransition } from "react";
import type { BacklogGroup } from "@/lib/receipts/priority";
import { useFlash } from "../flash";
import { MailIcon } from "../icon-action";
import { sendReceiptEmails } from "./actions";

/** "12 waiting for their QR · 3 partial payers · 85 only need a receipt" — empty groups left out. */
function describeSplit(split: Record<BacklogGroup, number>): string {
  const parts = [
    split.qr > 0 ? `${split.qr} waiting for their QR` : null,
    split.partial > 0 ? `${split.partial} partial payer${split.partial === 1 ? "" : "s"}` : null,
    split.receipt > 0 ? `${split.receipt} only need a receipt` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/**
 * The backlog send, built the same way evaluations/send-invites.tsx is:
 * one button, the remaining count in its own label, and every outcome
 * reported through the shared flash rather than a state of its own.
 *
 * Safe to press repeatedly — the action retries only what failed — so the
 * button never asks for confirmation or disables itself after a run.
 */
export function SendReceiptEmails({
  split,
}: {
  split: Record<BacklogGroup, number> | null;
}) {
  const [isSending, startTransition] = useTransition();
  const flash = useFlash();
  const pending = split === null ? null : split.qr + split.partial + split.receipt;

  // Null is "the queue couldn't be read" — the receipts table doesn't exist
  // until migration 0014 is pasted in. Saying "everyone has theirs" here
  // would be the most expensive possible wrong answer.
  const unreadable = pending === null;

  function send() {
    startTransition(async () => {
      const result = await sendReceiptEmails();
      if (!result.ok) {
        flash(result.error, "error");
        return;
      }
      if (result.sent === 0 && result.failed === 0) {
        flash("Nobody left to email.");
        return;
      }
      flash(
        `Sent ${result.sent}.` +
          (result.failed > 0
            ? ` ${result.failed} didn't go out` +
              (result.reason ? ` — Resend said: ${result.reason}` : "") +
              ". Press again to retry them."
            : ""),
        result.failed > 0 ? "error" : "success",
      );
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-ground/10 px-1 pt-1.5 pb-2.5 text-sm">
      <span aria-hidden className="text-accent-2">
        {MailIcon}
      </span>
      <h2 className="font-semibold">Receipts</h2>
      <p
        title="Sends in that order — anyone still without their QR goes first."
        className="min-w-0 text-ground/70"
      >
        {unreadable
          ? "Can't tell who still needs a receipt — paste migration 0014 into Supabase."
          : pending === 0
            ? "Every paid student has been emailed their receipt."
            : `${describeSplit(split!)}.`}
      </p>
      <span className="grow" />

      <button
        type="button"
        onClick={send}
        disabled={isSending || pending === 0}
        className="shrink-0 rounded px-1.5 py-1 font-semibold text-accent-2 underline underline-offset-4 hover:opacity-80 disabled:no-underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      >
        {isSending
          ? "Sending…"
          : unreadable
            ? "Send receipts"
            : pending === 0
              ? "Nothing to send"
              : `Send to ${pending}`}
      </button>
    </div>
  );
}
