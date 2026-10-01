"use client";

import { useState, useTransition } from "react";
import { drawablePool, latestDraw } from "@/lib/raffle/pool";
import type { RaffleDrawRow, RaffleEntrant } from "@/lib/raffle/types";
import { useSetNavHidden } from "../admin-nav";
import { useFlash } from "../flash";
import { drawNext, redrawLast } from "./actions";
import { useCountdownSettings } from "./countdown-settings";
import { RaffleSidebar } from "./raffle-sidebar";
import { RaffleWheel } from "./raffle-wheel";
import { useClaimClock } from "./use-claim-clock";
import { WinnerReveal, revealSettleMs } from "./winner-reveal";

type Stage = "idle" | "wheel" | "revealed";

/**
 * The whole show, run from one laptop plugged into the projector.
 *
 * Every draw is decided and recorded by the server before any of this
 * animates, so a connection dropping mid-spin changes nothing on screen. The
 * pool arrives as a prop for the same reason — the animation never fetches.
 *
 * Students and faculty are one pool and one winner history. Faculty are
 * switched in or out per draw, the same as added names.
 *
 * Layout: a left sidebar for eligibility, the claim countdown and the running
 * winner history, and a right panel for "the show" (idle/wheel/revealed, with
 * the Draw/Redraw action directly beneath it) — state ownership stays
 * entirely here regardless of which column renders which piece. The shared
 * AdminNav (rendered above by the admin layout) hides itself only while the
 * wheel is actually spinning, via useSetNavHidden — idle and revealed keep it,
 * same as every other admin page.
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
  const [pool, setPool] = useState(initialPool);
  const [excludePreviousWinners, setExcludePreviousWinners] = useState(true);
  const [includeExtraEntrants, setIncludeExtraEntrants] = useState(false);
  const [includeFaculty, setIncludeFaculty] = useState(true);
  const [active, setActive] = useState<RaffleDrawRow | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [lastAction, setLastAction] = useState<"draw" | "redraw" | null>(null);
  const [pending, startTransition] = useTransition();
  const [countdown, setCountdown] = useCountdownSettings();
  const clock = useClaimClock();
  const flash = useFlash();

  const animating = stage === "wheel";
  useSetNavHidden(animating);
  const standing = latestDraw(draws);
  // The same filter runDraw() applies on the server, so the count shown is the
  // pool the draw actually runs on.
  const effectivePool = drawablePool(pool, {
    extraEntrants: includeExtraEntrants,
    faculty: includeFaculty,
  });

  function run(action: () => Promise<{ ok: true; draw: RaffleDrawRow } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        // Never animate an outcome that was not actually decided.
        flash(result.error, "error");
        return;
      }

      clock.stop();
      setDraws((current) => [...current, result.draw]);
      setActive(result.draw);
      // Straight to the wheel — no name-blur intro. It added a fixed ~4s to
      // every draw and redraw, which adds up across a night of prizes.
      setStage("wheel");
    });
  }

  function onWheelDone() {
    setStage("revealed");
    if (!active) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    clock.begin(
      countdown.secs,
      countdown.autoStart ? (reduceMotion ? 0 : revealSettleMs(active.winner.fullName)) : null,
    );
  }

  const showClockControls = stage === "revealed" && active !== null && clock.totalSecs > 0;
  const timedOut = showClockControls && clock.phase === "done";

  return (
    // flex-1, not min-h-screen — the layout wrapper is already flex-col, so
    // this fills exactly the viewport height left over after AdminNav
    // instead of adding a second full 100vh under it (that was the scroll
    // bug: two min-h-screens stacked taller than the actual screen).
    <main className="flex flex-1 flex-col bg-deep text-ground">
      <div className="flex flex-1">
        {!animating ? (
          <RaffleSidebar
            draws={draws}
            pool={pool}
            onPoolChange={setPool}
            excludePreviousWinners={excludePreviousWinners}
            onToggleExclude={setExcludePreviousWinners}
            includeExtraEntrants={includeExtraEntrants}
            onToggleIncludeExtraEntrants={setIncludeExtraEntrants}
            includeFaculty={includeFaculty}
            onToggleIncludeFaculty={setIncludeFaculty}
            countdown={countdown}
            onCountdownChange={setCountdown}
            ticketsSold={ticketsSold}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          {stage === "idle" || active === null ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="font-display text-6xl uppercase text-accent-2 md:text-8xl">
                Raffle
              </p>
              <p className="max-w-prose text-ground/70">
                Draw a name whenever you’re ready. Everyone scanned in at the
                door is in the running, and so are the faculty who acknowledged
                the invitation. Turn off “Include faculty” for a students-only
                prize, or turn on “Include added names” to pull in anyone added
                under Setup.
              </p>
            </div>
          ) : null}

          {stage === "wheel" && active ? (
            <RaffleWheel
              finalists={active.finalists}
              winner={active.winner}
              onDone={onWheelDone}
            />
          ) : null}

          {stage === "revealed" && active ? (
            // Keyed on the draw so a redraw replays the name's entrance.
            <WinnerReveal
              key={active.id}
              winner={active.winner}
              isRedraw={active.isRedraw}
              poolSize={active.poolSize}
              clock={clock}
            />
          ) : null}

          {!animating ? (
            <div className="flex flex-col items-center gap-3 border-t border-ground/10 px-6 py-5">
              {showClockControls ? (
                <div
                  className="flex flex-wrap items-center justify-center gap-3"
                  role="group"
                  aria-label="Claim countdown"
                >
                  {clock.phase !== "done" && clock.phase !== "claimed" ? (
                    <button
                      type="button"
                      onClick={clock.phase === "running" ? clock.pause : clock.start}
                      className="rounded-full border border-ground/30 px-6 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors hover:bg-ground/10 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
                    >
                      {clock.phase === "running"
                        ? "Pause"
                        : clock.phase === "paused"
                          ? "Resume"
                          : "Start"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => clock.restart(countdown.secs)}
                    className="rounded-full border border-ground/30 px-6 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors hover:bg-ground/10 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
                  >
                    Restart
                  </button>
                  <button
                    type="button"
                    onClick={clock.claim}
                    disabled={clock.phase === "claimed"}
                    className="rounded-full bg-accent-3 px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-ground disabled:opacity-50"
                  >
                    Claimed
                  </button>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={pending || effectivePool.length === 0}
                  onClick={() => {
                    setLastAction("draw");
                    run(() =>
                      drawNext({ excludePreviousWinners, includeExtraEntrants, includeFaculty }),
                    );
                  }}
                  className="rounded-full bg-accent-2 px-8 py-3 font-semibold uppercase tracking-wide text-deep transition-opacity hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-ground disabled:opacity-50"
                >
                  {pending && lastAction === "draw" ? "Drawing…" : "Draw"}
                </button>

                {standing ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Redraw the last name? ${standing.winner.fullName} will be recorded as replaced, not erased.`,
                        )
                      ) {
                        setLastAction("redraw");
                        run(() =>
                          redrawLast({
                            supersedesDrawId: standing.id,
                            excludePreviousWinners,
                            includeExtraEntrants,
                            includeFaculty,
                          }),
                        );
                      }
                    }}
                    // Time ran out with nobody on stage: the next move is
                    // theirs to make, so the button says so. It never fires
                    // by itself.
                    className={`rounded-full bg-accent-4 px-8 py-3 font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-ground disabled:opacity-50 ${
                      timedOut ? "animate-pulse ring-4 ring-accent-4/40" : ""
                    }`}
                  >
                    {pending && lastAction === "redraw" ? "Redrawing…" : "Redraw last"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
