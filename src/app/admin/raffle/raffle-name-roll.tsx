"use client";

import { useEffect, useRef, useState } from "react";
import { entrantDetail } from "@/lib/raffle/pool";
import type { RaffleEntrant } from "@/lib/raffle/types";

// Every name in the draw flashes past, fast at first and slowing down, then
// lands on the winner. About six seconds from start to the held name.
const STEPS = 28;
const FIRST_MS = 40;
const GROWTH = 1.1;
const LAND_MS = 900;

type Frame = { prev: RaffleEntrant | null; current: RaffleEntrant | null; next: RaffleEntrant | null };

/**
 * The names shown on the way to the winner, the winner last. Random picks
 * from everyone in the draw, never the same name twice in a row. Pure
 * decoration: the winner was chosen and saved by the server before this
 * mounted, and cannot change here.
 */
function buildReel(names: readonly RaffleEntrant[], winner: RaffleEntrant): RaffleEntrant[] {
  const others = names.filter((name) => name.registrationId !== winner.registrationId);
  const reel: RaffleEntrant[] = [];
  for (let i = 0; i < STEPS - 1; i++) {
    const source = others.length > 0 ? others : [winner];
    let pick = source[Math.floor(Math.random() * source.length)];
    if (source.length > 1 && reel.length > 0 && pick === reel[reel.length - 1]) {
      pick = source[(source.indexOf(pick) + 1) % source.length];
    }
    reel.push(pick);
  }
  reel.push(winner);
  return reel;
}

/**
 * The draw animation. Replaces the 12-slice wheel so the whole scanned-in
 * crowd is visibly in the running, however many that is — a wheel with 600
 * slices cannot be read, a stream of names can.
 */
export function RaffleNameRoll({
  names,
  winner,
  onDone,
}: {
  /** Everyone eligible for this draw. */
  names: readonly RaffleEntrant[];
  winner: RaffleEntrant;
  onDone: () => void;
}) {
  const [frame, setFrame] = useState<Frame>({ prev: null, current: null, next: null });
  const [landed, setLanded] = useState(false);
  // Held in a ref so a new callback identity each render never restarts a
  // roll that is already under way.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (reduceMotion) {
      timers.push(
        setTimeout(() => {
          setFrame({ prev: null, current: winner, next: null });
          setLanded(true);
        }, 0),
        setTimeout(() => onDoneRef.current(), LAND_MS),
      );
      return () => timers.forEach(clearTimeout);
    }

    const reel = buildReel(names, winner);
    let at = 0;
    let gap = FIRST_MS;
    reel.forEach((entrant, index) => {
      timers.push(
        setTimeout(
          () =>
            setFrame({
              prev: reel[index - 1] ?? null,
              current: entrant,
              next: reel[index + 1] ?? null,
            }),
          at,
        ),
      );
      at += gap;
      gap *= GROWTH;
    });
    timers.push(setTimeout(() => setLanded(true), at));
    timers.push(setTimeout(() => onDoneRef.current(), at + LAND_MS));

    return () => timers.forEach(clearTimeout);
    // The draw is fixed for the life of this component; a changed pool must
    // not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner.registrationId]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-ground/60">
        {names.length} {names.length === 1 ? "name" : "names"} in the draw
      </p>

      <div className="flex w-full max-w-5xl flex-col items-center gap-4">
        <p
          aria-hidden
          className="min-h-[1.2em] font-display text-3xl uppercase text-ground/25 md:text-5xl"
        >
          {frame.prev?.fullName ?? ""}
        </p>
        <p
          aria-live="off"
          className={`font-display text-5xl uppercase leading-none md:text-8xl ${
            landed ? "text-accent-2" : "text-white"
          }`}
          style={
            landed
              ? { textShadow: "0 0 40px color-mix(in srgb, var(--color-accent-2) 70%, transparent)" }
              : undefined
          }
        >
          {frame.current?.fullName ?? "…"}
        </p>
        <p className="min-h-[1.5em] text-lg text-ground/60">
          {frame.current ? entrantDetail(frame.current) : ""}
        </p>
        <p
          aria-hidden
          className="min-h-[1.2em] font-display text-3xl uppercase text-ground/25 md:text-5xl"
        >
          {frame.next?.fullName ?? ""}
        </p>
      </div>
    </div>
  );
}
