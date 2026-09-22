"use client";

import { useTransition } from "react";
import { useFlash } from "../flash";
import { resolveEmailFix } from "./actions";

/**
 * No confirmation modal, unlike Void — this only flips a bookkeeping flag
 * after staff has already made the real change (editing the address)
 * elsewhere. Nothing here touches a registration or sends anything.
 */
export function ResolveButton({ id, fullName }: { id: string; fullName: string }) {
  const [pending, startTransition] = useTransition();
  const flash = useFlash();

  function handleClick() {
    startTransition(async () => {
      const result = await resolveEmailFix(id);
      if (!result.ok) {
        flash(result.error ?? "Something went wrong.", "error");
        return;
      }
      flash(`Marked ${fullName}'s request resolved.`);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
    >
      {pending ? "Marking…" : "Mark resolved"}
    </button>
  );
}
