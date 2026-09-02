"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { EVENT, RAFFLE_PRIZES } from "@/lib/config/event";
import { latestDrawForPrize } from "@/lib/raffle/draw";
import type { RaffleDrawRow, RaffleEntrant } from "@/lib/raffle/types";
import { drawPrize, redrawPrize } from "./actions";
import { FinalistBlur } from "./finalist-blur";
import { OperatorControls } from "./operator-controls";
import { RaffleWheel } from "./raffle-wheel";

type Stage = "idle" | "shuffling" | "wheel" | "revealed";

/**
 * The whole show, run from one laptop plugged into the projector.
 *
 * Every draw is decided and recorded by the server before any of this
 * animates, so a connection dropping mid-spin changes nothing on screen. The
 * pool arrives as a prop for the same reason — the animation never fetches.
 */
export function RaffleProjector({
  initialPool,
  initialDraws,
  ticketsSold,
}: {
  initialPool: RaffleEntrant[];
  initialDraws: RaffleDrawRow[];
  ticketsSold: number;
}) {
  const [draws, setDraws] = useState(initialDraws);
  const [selectedKey, setSelectedKey] = useState<string>(RAFFLE_PRIZES[0].key);
  const [excludePreviousWinners, setExcludePreviousWinners] = useState(true);
  const [active, setActive] = useState<RaffleDrawRow | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const animating = stage === "shuffling" || stage === "wheel";

  function run(action: () => Promise<{ ok: true; draw: RaffleDrawRow } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        // Never animate an outcome that was not actually decided.
        setError(result.error);
        return;
      }

      setDraws((current) => [...current, result.draw]);
      setActive(result.draw);
      setStage("shuffling");
    });
  }

  return (
    <main className="flex min-h-screen flex-col bg-night-ground text-night-ink">
      <header className="flex items-center justify-between px-6 py-4 text-sm text-night-ink/60">
        <p className="uppercase tracking-[0.3em]">{EVENT.name} raffle</p>
        {!animating ? (
          <Link
            href="/admin/dashboard"
            className="underline focus:outline-2 focus:outline-offset-2 focus:outline-night-accent-3"
          >
            Attendance
          </Link>
        ) : null}
      </header>

      {stage === "idle" || active === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-display text-6xl uppercase text-night-accent-2 md:text-8xl">
            Raffle
          </p>
          <p className="max-w-prose text-night-ink/70">
            Pick a prize below and draw. Everyone scanned in at the door is in
            the running.
          </p>
        </div>
      ) : null}

      {stage === "shuffling" && active ? (
        <FinalistBlur
          pool={initialPool}
          finalists={active.finalists}
          onDone={() => setStage("wheel")}
        />
      ) : null}

      {stage === "wheel" && active ? (
        <RaffleWheel
          finalists={active.finalists}
          winner={active.winner}
          onDone={() => setStage("revealed")}
        />
      ) : null}

      {stage === "revealed" && active ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-night-ink/60">
            {active.isRedraw ? `${active.prizeName} — redraw` : active.prizeName}
          </p>
          <p className="font-display text-6xl uppercase leading-[0.9] text-night-accent-2 md:text-8xl">
            {active.winner.fullName}
          </p>
          <p className="text-2xl text-night-ink/80">
            {active.winner.yearLevel} · {active.winner.section}
          </p>
          <p className="text-sm text-night-ink/50">
            Drawn from {active.poolSize} eligible students
          </p>
        </div>
      ) : null}

      {!animating ? (
        <OperatorControls
          draws={draws}
          selectedKey={selectedKey}
          onSelect={(key) => {
            setSelectedKey(key);
            setError(null);

            // Reopening a drawn prize redisplays its result — replaying the
            // spin for something the room already heard reads as a redraw.
            const standing = latestDrawForPrize(draws, key);
            setActive(standing);
            setStage(standing ? "revealed" : "idle");
          }}
          excludePreviousWinners={excludePreviousWinners}
          onToggleExclude={setExcludePreviousWinners}
          eligible={initialPool.length}
          ticketsSold={ticketsSold}
          pending={pending}
          error={error}
          onDraw={() =>
            run(() => drawPrize({ prizeKey: selectedKey, excludePreviousWinners }))
          }
          onRedraw={(supersedesDrawId) =>
            run(() =>
              redrawPrize({
                prizeKey: selectedKey,
                supersedesDrawId,
                excludePreviousWinners,
              }),
            )
          }
        />
      ) : null}
    </main>
  );
}
