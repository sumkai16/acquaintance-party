"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFlash } from "../flash";
import { approve, reject } from "./actions";

export function RemittanceActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const router = useRouter();
  const flash = useFlash();

  function onApprove() {
    if (
      !window.confirm(
        "Approve this remittance? This moves it out of Staff's cash and can't be undone here.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await approve(id);
      if (!result.ok) {
        flash(result.error ?? "Something went wrong.", "error");
        return;
      }
      flash("Remittance approved.");
      router.refresh();
    });
  }

  function onReject() {
    startTransition(async () => {
      const result = await reject(id, reason);
      if (!result.ok) {
        flash(result.error ?? "Something went wrong.", "error");
        return;
      }
      setReason("");
      flash("Remittance rejected.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onApprove}
        disabled={pending}
        className="rounded bg-accent px-3 py-1.5 text-xs font-semibold uppercase text-white disabled:opacity-60"
      >
        Approve
      </button>
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason for rejecting"
        maxLength={300}
        aria-label="Reason for rejecting this remittance"
        className="w-40 rounded border border-ground/20 bg-ground/5 px-2 py-1.5 text-xs text-ground placeholder:text-ground/40 focus:border-accent-2 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      />
      <button
        type="button"
        onClick={onReject}
        disabled={pending || !reason.trim()}
        className="rounded border border-ground/30 px-3 py-1.5 text-xs font-semibold uppercase text-ground/80 disabled:opacity-60"
      >
        Reject
      </button>
    </div>
  );
}
