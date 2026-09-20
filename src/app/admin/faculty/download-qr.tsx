"use client";

import { useState } from "react";
import { useFlash } from "../flash";

/** Pixels per side of the saved file — enough for A4 print at about 10cm. */
const PNG_SIZE = 1200;

/**
 * Saves the invitation QR as a PNG.
 *
 * Rasterised in the browser from the same SVG the page already shows, rather
 * than by a server route: nothing new to authenticate, no image dependency to
 * add, and what is downloaded is by construction what is on screen. The SVG is
 * drawn straight onto a 1200px canvas, so the browser rasterises it at that
 * size instead of stretching a small bitmap.
 */
export function DownloadQr({ svgDataUrl, filename }: { svgDataUrl: string; filename: string }) {
  const [busy, setBusy] = useState(false);
  const flash = useFlash();

  async function download() {
    setBusy(true);
    try {
      const image = new Image();
      image.src = svgDataUrl;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = PNG_SIZE;
      canvas.height = PNG_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no 2d context");
      context.drawImage(image, 0, 0, PNG_SIZE, PNG_SIZE);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("toBlob returned nothing");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("QR download failed", error);
      flash("Could not save the QR. Try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="self-start rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
    >
      {busy ? "Saving…" : "Download QR (PNG)"}
    </button>
  );
}
