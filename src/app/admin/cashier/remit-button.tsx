"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFlash } from "../flash";
import { formatPeso } from "@/lib/config/event";
import { submitRemittance } from "./actions";

export function RemitButton({ availableCentavos }: { availableCentavos: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const flash = useFlash();

  if (availableCentavos <= 0) return null;

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded bg-accent px-6 py-3 font-semibold uppercase tracking-wide text-white"
      >
        Remit Cash
      </button>
    );
  }

  function onConfirm() {
    startTransition(async () => {
      const result = await submitRemittance(availableCentavos);
      if (!result.ok) {
        flash(result.error ?? "Something went wrong.", "error");
        return;
      }
      setConfirming(false);
      flash("Remittance submitted.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-ground/20 bg-ground/5 p-5">
      <h2 className="font-display text-xl uppercase">Cash Remittance</h2>
      <p className="mt-2 text-ground/70">Amount to remit:</p>
      <p className="text-3xl font-bold tabular-nums">{formatPeso(availableCentavos)}</p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="rounded bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Submitting…" : "Submit Remittance"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="px-5 py-2.5 text-ground/70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
