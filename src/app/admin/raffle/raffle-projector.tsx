"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { EVENT } from "@/lib/config/event";
import { latestDrawForPrize } from "@/lib/raffle/draw";
import type { RaffleDrawRow, RaffleEntrant, RafflePrize } from "@/lib/raffle/types";
import { drawPrize, redrawPrize } from "./actions";
import { OperatorControls } from "./operator-controls";
import { RaffleWheel } from "./raffle-wheel";

type Stage = "idle" | "wheel" | "revealed";

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
  initialPrizes,
  ticketsSold,
}: {
  initialPool: RaffleEntrant[];
  initialDraws: RaffleDrawRow[];
  initialPrizes: RafflePrize[];
  ticketsSold: number;
}) {
  const [draws, setDraws] = useState(initialDraws);
  const [prizes, setPrizes] = useState(initialPrizes);
  const [pool, setPool] = useState(initialPool);
  const [selectedKey, setSelectedKey] = useState<string>(initialPrizes[0]?.id ?? "");
  const [excludePreviousWinners, setExcludePreviousWinners] = useState(true);
  const [includeExtraEntrants, setIncludeExtraEntrants] = useState(false);
  const [active, setActive] = useState<RaffleDrawRow | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const animating = stage === "wheel";

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
      // Straight to the wheel — no name-blur intro. It added a fixed ~4s to
      // every draw and redraw, which adds up across a night of prizes.
      setStage("wheel");
    });
  }

  return (
    <main className="flex min-h-screen flex-col bg-deep text-ground">
      <header className="flex items-center justify-between px-6 py-4 text-sm text-ground/60">
        <p className="uppercase tracking-[0.3em]">{EVENT.name} raffle</p>
        {!animating ? (
          <Link
            href="/admin/dashboard"
            className="underline focus:outline-2 focus:outline-offset-2 focus:outline-accent-3"
          >
            Attendance
          </Link>
        ) : null}
      </header>

      {stage === "idle" || active === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-display text-6xl uppercase text-accent-2 md:text-8xl">
            Raffle
          </p>
          <p className="max-w-prose text-ground/70">
            Pick a prize below and draw. Everyone scanned in at the door is in
            the running — turn on “Include added names” to pull in anyone
            added under Setup too.
          </p>
        </div>
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
          <p className="text-sm uppercase tracking-[0.3em] text-ground/60">
            {active.isRedraw ? `${active.prizeName} — redraw` : active.prizeName}
          </p>
          <p className="font-display text-6xl uppercase leading-[0.9] text-accent-2 md:text-8xl">
            {active.winner.fullName}
          </p>
          <p className="text-2xl text-ground/80">
            {active.winner.yearLevel} · {active.winner.section}
          </p>
          <p className="text-sm text-ground/50">
            Drawn from {active.poolSize} eligible students
          </p>
        </div>
      ) : null}

      {!animating ? (
        <OperatorControls
          draws={draws}
          prizes={prizes}
          onPrizesChange={(next) => {
            setPrizes(next);
            // A prize just added from empty — select it so Draw is usable
            // without an extra click.
            if (!selectedKey && next.length > 0) setSelectedKey(next[0].id);
          }}
          pool={pool}
          onPoolChange={setPool}
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
          includeExtraEntrants={includeExtraEntrants}
          onToggleIncludeExtraEntrants={setIncludeExtraEntrants}
          ticketsSold={ticketsSold}
          pending={pending}
          error={error}
          onDraw={() =>
            run(() =>
              drawPrize({ prizeKey: selectedKey, excludePreviousWinners, includeExtraEntrants }),
            )
          }
          onRedraw={(supersedesDrawId) =>
            run(() =>
              redrawPrize({
                prizeKey: selectedKey,
                supersedesDrawId,
                excludePreviousWinners,
                includeExtraEntrants,
              }),
            )
          }
        />
      ) : null}
    </main>
  );
}
