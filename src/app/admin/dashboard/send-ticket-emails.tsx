"use client";

import { useTransition } from "react";
import { useFlash } from "../flash";
import { sendTicketEmails } from "./actions";

/**
 * The backlog send, built the same way evaluations/send-invites.tsx is:
 * one button, the remaining count in its own label, and every outcome
 * reported through the shared flash rather than a state of its own.
 *
 * Safe to press repeatedly — the action retries only what failed — so the
 * button never asks for confirmation or disables itself after a run.
 */
export function SendTicketEmails({ pending }: { pending: number | null }) {
  const [isSending, startTransition] = useTransition();
  const flash = useFlash();

  // Null is "the queue couldn't be read" — the column doesn't exist until
  // migration 0009 is pasted in. Saying "everyone has been emailed" here
  // would be the most expensive possible wrong answer.
  const unreadable = pending === null;

  function send() {
    startTransition(async () => {
      const result = await sendTicketEmails();
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
            ? ` ${result.failed} didn't go out — Resend's free plan caps at ` +
              `100 emails a day. Press again tomorrow to send the rest.`
            : ""),
        result.failed > 0 ? "error" : "success",
      );
    });
  }

  return (
    <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ground/10 bg-ground/5 px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold">Ticket emails</h2>
        <p className="text-sm text-ground/70">
          {unreadable
            ? "Can't tell who still needs their QR — paste migration 0009 into Supabase."
            : pending === 0
              ? "Every approved payee has been sent their QR."
              : `${pending} approved payee${pending === 1 ? " hasn't" : "s haven't"} been sent their QR yet.`}
        </p>
      </div>

      <button
        type="button"
        onClick={send}
        disabled={isSending || pending === 0}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      >
        {isSending
          ? "Sending…"
          : unreadable
            ? "Send tickets"
            : pending === 0
              ? "Nothing to send"
              : `Send to ${pending}`}
      </button>
    </section>
  );
}
