"use client";

import { useEffect, useState } from "react";

/**
 * A full-screen view of one receipt, opened from its thumbnail in the
 * review table. Starts fit-to-screen; clicking the image toggles to its
 * native resolution inside a scrollable frame — a receipt photographed on a
 * phone is usually much larger than the screen, and the reference number or
 * a payee name is often only legible at that size.
 */
export function ReceiptLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [zoomed, setZoomed] = useState(false);

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
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 rounded-full bg-black/40 px-3 py-1.5 text-sm font-medium text-white hover:bg-black/60 focus:outline-2 focus:outline-offset-2 focus:outline-white"
      >
        Close
      </button>

      <div
        className={
          zoomed
            ? "max-h-[90vh] max-w-[90vw] overflow-auto rounded bg-black/20"
            : "max-h-[90vh] max-w-[90vw]"
        }
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onClick={() => setZoomed((current) => !current)}
          className={
            zoomed
              ? "cursor-zoom-out"
              : "max-h-[90vh] max-w-[90vw] cursor-zoom-in object-contain"
          }
        />
      </div>
    </div>
  );
}
