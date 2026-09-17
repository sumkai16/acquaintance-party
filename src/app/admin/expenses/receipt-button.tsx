"use client";

import { useState } from "react";
import { ReceiptLightbox } from "../receipt-lightbox";

/**
 * The image src is the receipt route itself, which redirects to a freshly
 * signed URL — so opening the viewer never shows an expired link, however
 * long the page has been open.
 */
export function ReceiptButton({ expenseId, itemName }: { expenseId: string; itemName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View receipt for ${itemName}`}
        className="font-semibold text-accent-2 underline focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      >
        View
      </button>
      {open ? (
        <ReceiptLightbox
          src={`/admin/expenses/receipt/${expenseId}`}
          alt={`Receipt for ${itemName}`}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
