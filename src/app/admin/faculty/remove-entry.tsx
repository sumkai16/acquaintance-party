"use client";

import { useTransition } from "react";
import { useFlash } from "../flash";
import { removeFacultyEntry } from "./actions";

/**
 * Removes a junk name submitted through the shared QR.
 *
 * Confirms first, the same way the raffle's Redraw does: the QR is public, so
 * this list can hold both real faculty and nonsense, and the two sit next to
 * each other in the same table where a mis-tap is easy.
 */
export function RemoveEntry({ id, fullName }: { id: string; fullName: string }) {
  const [pending, startTransition] = useTransition();
  const flash = useFlash();

  function remove() {
    if (!window.confirm(`Remove ${fullName} from the faculty list?`)) return;

    startTransition(async () => {
      const result = await removeFacultyEntry(id);
      if (!result.ok) {
        flash(result.error, "error");
        return;
      }
      flash(`Removed ${fullName}.`);
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      className="font-semibold text-red-300 underline disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
