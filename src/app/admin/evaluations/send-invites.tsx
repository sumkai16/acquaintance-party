"use client";

import { useTransition } from "react";
import { useFlash } from "../flash";
import { sendEvaluationInvites } from "./actions";

export function SendInvites({ pending }: { pending: number }) {
  const [isSending, startTransition] = useTransition();
  const flash = useFlash();

  function send() {
    startTransition(async () => {
      const result = await sendEvaluationInvites();
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
            ? ` ${result.failed} failed — press again to retry those.`
            : ""),
        result.failed > 0 ? "error" : "success",
      );
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={send}
        disabled={isSending || pending === 0}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      >
        {isSending
          ? "Sending…"
          : pending === 0
            ? "Everyone has been emailed"
            : `Send to ${pending} attendee${pending === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
