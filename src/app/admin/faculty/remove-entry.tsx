"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "../confirm-dialog";
import { useFlash } from "../flash";
import { removeFacultyEntry } from "./actions";

/**
 * Removes a junk name submitted through the shared QR.
 *
 * Confirms first: the QR is public, so this list can hold both real faculty
 * and nonsense, and the two sit next to each other in the same table where a
 * mis-tap is easy.
 */
export function RemoveEntry({ id, fullName }: { id: string; fullName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const flash = useFlash();

  function remove() {
    startTransition(async () => {
      const result = await removeFacultyEntry(id);
      if (!result.ok) {
        flash(result.error, "error");
        return;
      }
      setOpen(false);
      flash(`Removed ${fullName}.`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-semibold text-red-300 underline focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      >
        Remove
      </button>

      {open ? (
        <ConfirmDialog
          title={`Remove ${fullName}?`}
          confirmLabel="Remove"
          busyLabel="Removing…"
          busy={pending}
          danger
          onConfirm={remove}
          onCancel={() => setOpen(false)}
        >
          <p>
            They come off the faculty list and out of the faculty raffle pool.
            This can&apos;t be undone.
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
