"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFlash } from "../flash";
import { voidExpenseAction } from "./actions";

export function VoidExpense({ id }: { id: string }) {
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const flash = useFlash();

  function onVoid() {
    startTransition(async () => {
      const result = await voidExpenseAction(id, reason);
      if (!result.ok) {
        flash(result.error ?? "Something went wrong.", "error");
        return;
      }
      setReason("");
      flash("Expense voided.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason for voiding"
        maxLength={300}
        aria-label="Reason for voiding this expense"
        className="w-40 rounded border border-ground/20 bg-ground/5 px-2 py-1.5 text-xs text-ground placeholder:text-ground/40 focus:border-accent-2 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      />
      <button
        type="button"
        onClick={onVoid}
        disabled={pending || !reason.trim()}
        className="rounded border border-red-400/60 px-3 py-1.5 text-xs font-semibold uppercase text-red-300 disabled:opacity-40"
      >
        Void
      </button>
    </div>
  );
}
