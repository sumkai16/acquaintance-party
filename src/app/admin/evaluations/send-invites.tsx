"use client";

import { useState, useTransition } from "react";
import { sendEvaluationInvites } from "./actions";

export function SendInvites({ pending }: { pending: number }) {
  const [isSending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function send() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendEvaluationInvites();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      if (result.sent === 0 && result.failed === 0) {
        setMessage("Nobody left to email.");
        return;
      }
      setMessage(
        `Sent ${result.sent}.` +
          (result.failed > 0
            ? ` ${result.failed} failed — press again to retry those.`
            : ""),
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
      {message ? (
        <p role="status" className="text-sm text-ground/80">
          {message}
        </p>
      ) : null}
    </div>
  );
}
