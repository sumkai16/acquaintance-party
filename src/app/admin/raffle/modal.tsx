"use client";

import { useEffect } from "react";

/**
 * A themed dialog overlay — backdrop click and Escape both close it. Shared
 * by the raffle admin's two stacked modals (Setup, Add entrants inside it),
 * so the dialog chrome (backdrop, Escape handling, header, close button)
 * exists in one place rather than three.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-lg border border-ground/15 bg-deep p-6"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full px-2 py-1 text-ground/60 hover:bg-ground/10 hover:text-ground focus:outline-2 focus:outline-offset-2 focus:outline-accent-4"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
