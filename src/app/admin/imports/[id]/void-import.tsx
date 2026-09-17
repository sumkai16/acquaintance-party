"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "../../modal";
import { useFlash } from "../../flash";
import { voidImport } from "../actions";

export function VoidImport({
  batchId,
  fileName,
  activeCount,
}: {
  batchId: string;
  fileName: string;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const flash = useFlash();

  function onConfirm() {
    startTransition(async () => {
      const result = await voidImport(batchId, reason);
      if (!result.ok) {
        flash(result.error, "error");
        return;
      }
      flash(`Voided ${result.voided} ticket${result.voided === 1 ? "" : "s"}.`);
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-red-400/60 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 focus:outline-2 focus:outline-offset-2 focus:outline-red-400"
      >
        Void this import
      </button>

      {open ? (
        <Modal title={`Void import "${fileName}"`} onClose={() => setOpen(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-sm text-ground/70">
              This voids <strong className="text-ground">{activeCount}</strong> ticket
              {activeCount === 1 ? "" : "s"}. Their QR codes stop working at the door, and
              the cash drops out of the importer&rsquo;s collection. Students are not
              emailed. Tickets already voided are left as they are.
            </p>
            <textarea
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason, e.g. wrong file uploaded"
              maxLength={300}
              rows={3}
              aria-label="Reason for voiding this import"
              className="rounded border border-ground/25 bg-deep px-3 py-2 text-sm placeholder:text-ground/40 focus:border-accent-3 focus:outline-2 focus:outline-offset-2 focus:outline-accent-3"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pending || !reason.trim()}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Voiding…" : `Void ${activeCount} ticket${activeCount === 1 ? "" : "s"}`}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm font-semibold text-ground/60 hover:text-ground"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
