"use client";

import { useEffect, useRef, useState } from "react";
import type { RaffleEntrant } from "@/lib/raffle/types";

const SPIN_MS = 6000;
const EXTRA_SPINS = 6;

const SLICE_COLORS = [
  "var(--color-night-accent)",
  "var(--color-night-accent-2)",
  "var(--color-night-accent-3)",
];

/**
 * Stage two: the wheel spins and stops on the winner.
 *
 * The winner is already decided and already recorded, so this only has to
 * land on a known slice. Rotating by `-centre` puts that slice under the
 * pointer; the whole turns before it are decoration.
 */
export function RaffleWheel({
  finalists,
  winner,
  onDone,
}: {
  finalists: RaffleEntrant[];
  winner: RaffleEntrant;
  onDone: () => void;
}) {
  const [rotation, setRotation] = useState(0);
  // Held in a ref so a new callback identity each render never restarts a
  // spin that is already under way.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  const slice = 360 / finalists.length;
  const winnerIndex = finalists.findIndex(
    (entrant) => entrant.registrationId === winner.registrationId,
  );

  useEffect(() => {
    const centre = winnerIndex * slice + slice / 2;
    // Stopping dead-centre every time looks mechanical. Kept well inside the
    // winning slice: it cannot change who wins, and it must never stop near
    // enough to a boundary for the room to argue about which slice it is.
    const jitter = (Math.random() - 0.5) * slice * 0.35;
    const target = EXTRA_SPINS * 360 + ((360 - centre) % 360) + jitter;

    // Let the browser paint 0deg before the transition starts, or it snaps
    // to the end instead of animating.
    const frame = requestAnimationFrame(() => setRotation(target));
    const timer = setTimeout(() => onDoneRef.current(), SPIN_MS);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [winnerIndex, slice]);

  const gradient = finalists
    .map((_, i) => {
      const color = SLICE_COLORS[i % SLICE_COLORS.length];
      return `${color} ${i * slice}deg ${(i + 1) * slice}deg`;
    })
    .join(", ");

  // Fewer finalists means wider slices, so the label can afford to be
  // bigger. Sized in tiers rather than continuously so it stays predictable
  // to eyeball while tuning.
  const labelSize =
    finalists.length <= 6
      ? "top-8 w-40 text-2xl"
      : finalists.length <= 9
        ? "top-7 w-36 text-xl"
        : "top-6 w-32 text-base";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <p className="text-sm uppercase tracking-[0.3em] text-night-ink/60">
        {finalists.length} finalists
      </p>

      <div className="relative aspect-square w-[min(70vh,90vw)]">
        <div
          className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[24px] border-x-transparent"
          style={{ borderTopColor: "var(--color-night-ink)" }}
          aria-hidden
        />

        <div
          className="h-full w-full rounded-full ring-4 ring-night-ink/20"
          style={{
            backgroundImage: `conic-gradient(${gradient})`,
            transform: `rotate(${rotation}deg)`,
            transition: `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.67, 0.16, 1)`,
          }}
        >
          {finalists.map((entrant, i) => (
            <div
              key={entrant.registrationId}
              className="absolute inset-0"
              style={{ transform: `rotate(${i * slice + slice / 2}deg)` }}
            >
              <span
                className={`absolute left-1/2 -translate-x-1/2 whitespace-normal text-center leading-tight font-semibold text-night-ground ${labelSize}`}
              >
                {entrant.fullName}
              </span>
            </div>
          ))}
        </div>

        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-night-deep ring-4 ring-night-ink/20" />
      </div>
    </div>
  );
}
