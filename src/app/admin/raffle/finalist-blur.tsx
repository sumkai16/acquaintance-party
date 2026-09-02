"use client";

import { useEffect, useRef, useState } from "react";
import type { RaffleEntrant } from "@/lib/raffle/types";

const BLUR_MS = 3200;
const HOLD_MS = 700;
/** Enough names to read as a crowd. Mounting all 600 janks a laptop. */
const DECOY_LIMIT = 80;

/**
 * Stage one: names rush past and slow to a stop on the shortlist.
 *
 * The sequence ends with the real finalists, so it settles onto them without
 * needing any randomness here — the outcome was decided on the server before
 * this component ever mounted.
 */
export function FinalistBlur({
  pool,
  finalists,
  onDone,
}: {
  pool: RaffleEntrant[];
  finalists: RaffleEntrant[];
  onDone: () => void;
}) {
  const [name, setName] = useState(finalists[0]?.fullName ?? "");
  // Held in a ref so a new callback identity each render never restarts the
  // run that is already under way.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const finalistIds = new Set(finalists.map((f) => f.registrationId));
    const decoys = pool
      .filter((entrant) => !finalistIds.has(entrant.registrationId))
      .slice(0, DECOY_LIMIT)
      .map((entrant) => entrant.fullName);
    const sequence = [...decoys, ...finalists.map((f) => f.fullName)];

    let frame = 0;
    let holdTimer: ReturnType<typeof setTimeout>;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / BLUR_MS, 1);
      // Fast at first, crawling by the end — the deceleration is what makes
      // the last few names readable.
      const eased = 1 - Math.pow(1 - t, 3);
      setName(sequence[Math.min(Math.floor(eased * sequence.length), sequence.length - 1)]);

      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        holdTimer = setTimeout(() => onDoneRef.current(), HOLD_MS);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(holdTimer);
    };
  }, [pool, finalists]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <p className="text-sm uppercase tracking-[0.3em] text-night-ink/60">
        Drawing the shortlist
      </p>
      <p className="px-6 text-center font-display text-5xl uppercase text-night-ink md:text-7xl">
        {name}
      </p>
    </div>
  );
}
