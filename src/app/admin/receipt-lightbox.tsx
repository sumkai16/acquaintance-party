"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const STEP = 1.25;
const DOUBLE_TAP_SCALE = 2.5;

type Point = { x: number; y: number };

const clamp = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

/**
 * A full-screen, zoomable view of one receipt photo — shared by Payments and
 * Expenses. Zoom with the wheel, a pinch, the +/− buttons, or a double
 * click/tap; drag to pan once zoomed. Reference numbers and item lines on a
 * phone photo are often only legible zoomed in, so fit-to-screen is just
 * the starting point.
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
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // Transitions smooth button/wheel zoom but would make drag and pinch lag.
  const [interacting, setInteracting] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const dragged = useRef(false);
  const lastTap = useRef(0);

  /** Zooms to `next`, keeping the point under `focus` (stage-center coords) still. */
  const zoomTo = useCallback(
    (next: number, focus: Point = { x: 0, y: 0 }) => {
      const target = clamp(next);
      setOffset((current) =>
        target === 1
          ? { x: 0, y: 0 }
          : {
              x: focus.x - (focus.x - current.x) * (target / scale),
              y: focus.y - (focus.y - current.y) * (target / scale),
            },
      );
      setScale(target);
    },
    [scale],
  );

  const fromCenter = useCallback((clientX: number, clientY: number): Point => {
    const rect = stageRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "+" || event.key === "=") zoomTo(scale * STEP);
      if (event.key === "-") zoomTo(scale / STEP);
      if (event.key === "0") zoomTo(1);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, zoomTo, scale]);

  // The page behind shouldn't scroll while the viewer owns the screen.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // React attaches wheel listeners as passive, which can't preventDefault —
  // so the page would scroll instead of zooming. Attached by hand instead.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      zoomTo(event.deltaY < 0 ? scale * STEP : scale / STEP, fromCenter(event.clientX, event.clientY));
    }
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomTo, fromCenter, scale]);

  function onPointerDown(event: React.PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteracting(true);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragged.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale };
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = fromCenter((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomTo((pinchStart.current.scale * distance) / pinchStart.current.distance, mid);
      dragged.current = true;
      return;
    }

    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragged.current = true;
    if (scale > 1) setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }

  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) setInteracting(false);
    if (dragged.current || pointers.current.size > 0) return;

    // A tap, not a drag. A single tap does nothing — closing on it would
    // swallow the first half of every double-tap. Close is the button or Esc.
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      zoomTo(scale > 1 ? 1 : DOUBLE_TAP_SCALE, fromCenter(event.clientX, event.clientY));
      return;
    }
    lastTap.current = now;
  }

  const controlClass =
    "rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-40 focus:outline-2 focus:outline-offset-2 focus:outline-white";

  return (
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => zoomTo(scale / STEP)} disabled={scale <= MIN_SCALE} aria-label="Zoom out" className={controlClass}>
            −
          </button>
          <span className="w-14 text-center text-sm tabular-nums text-white/80">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => zoomTo(scale * STEP)} disabled={scale >= MAX_SCALE} aria-label="Zoom in" className={controlClass}>
            +
          </button>
          <button type="button" onClick={() => zoomTo(1)} disabled={scale === 1} className={controlClass}>
            Fit
          </button>
        </div>
        <button type="button" onClick={onClose} className={controlClass}>
          Close
        </button>
      </div>

      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative flex flex-1 touch-none items-center justify-center overflow-hidden select-none ${
          scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        }`}
      >
        {status === "loading" ? <p className="absolute text-sm text-white/70">Loading receipt…</p> : null}
        {status === "error" ? (
          <p className="absolute text-sm text-red-300">Could not load this receipt. Close and try again.</p>
        ) : null}
        {/* Signed Supabase URL (or a redirect to one), not a next/image host — plain img. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: interacting ? "none" : "transform 120ms ease-out",
          }}
          className={`pointer-events-none max-h-full max-w-full object-contain p-2 ${status === "ready" ? "" : "invisible"}`}
        />
      </div>

      <p className="px-4 pb-3 text-center text-xs text-white/50">
        Scroll, pinch, or double-tap to zoom · drag to move · Esc to close
      </p>
    </div>
  );
}
