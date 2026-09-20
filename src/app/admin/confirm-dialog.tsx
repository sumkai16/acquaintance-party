"use client";

import { Modal } from "./modal";

/**
 * A themed replacement for `window.confirm`, built on the shared Modal so it
 * has the same backdrop, Escape and close handling as every other admin
 * dialog.
 *
 * The browser's own confirm box names the site ("localhost:3000 says…"),
 * cannot be styled, and puts the destructive button where the eye lands
 * first. This puts the destructive action in red, says what will actually
 * happen in the body, and focuses **Cancel** — so a stray Enter or tap that
 * was meant for something else backs out instead of deleting.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel,
  busy = false,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  /** What will happen, in plain words — the consequence, not a restatement of the title. */
  children: React.ReactNode;
  confirmLabel: string;
  /** Shown on the confirm button while `busy`, e.g. "Removing…". */
  busyLabel?: string;
  busy?: boolean;
  /** Red confirm button, for anything that cannot be undone. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={busy ? () => {} : onCancel}>
      <div className="text-sm text-ground/75">{children}</div>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          // Focus lands here, not on the destructive button — see above.
          autoFocus
          className="rounded-full border border-ground/25 px-4 py-2 text-sm font-semibold hover:bg-ground/10 disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`rounded-full px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 ${
            danger ? "bg-red-600" : "bg-accent"
          }`}
        >
          {busy ? (busyLabel ?? "Working…") : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
