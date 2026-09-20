"use client";

import { useEffect, useRef } from "react";

/**
 * What every dialog on this page needs while it is open: Escape closes it,
 * the page behind stops scrolling, and focus moves to the close button so a
 * keyboard user lands inside it rather than on whatever they last tabbed to.
 */
export function useModal(open: boolean, onClose: () => void) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return closeRef;
}
