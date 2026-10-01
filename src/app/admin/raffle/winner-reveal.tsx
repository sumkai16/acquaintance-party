"use client";

import type { CSSProperties } from "react";
import type { RaffleEntrant } from "@/lib/raffle/types";
import { entrantDetail } from "@/lib/raffle/pool";
import type { ClaimClock } from "./use-claim-clock";
import styles from "./winner-reveal.module.css";

const LETTER_STAGGER_MS = 32;

/**
 * How long the name takes to finish arriving, in ms. The claim clock waits for
 * it before auto-starting, so the number never ticks while the name is still
 * landing.
 */
export function revealSettleMs(name: string): number {
  return name.length * LETTER_STAGGER_MS + 1100;
}

const fmt = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

const STATUS: Record<string, string> = {
  idle: "",
  ready: "Get ready",
  running: "Come up to claim your prize",
  paused: "Paused",
  done: "Time’s up",
  claimed: "Claimed — congratulations!",
};

/**
 * Stage three: the winner, over a sunset that sets as the claim time runs out.
 *
 * Presentational only. The clock lives in the projector, which also owns the
 * Pause / Restart / Claimed buttons: they sit with Draw and Redraw on the
 * operator's laptop, so the projected picture carries just the name and the
 * time.
 */
export function WinnerReveal({
  winner,
  isRedraw,
  poolSize,
  clock,
}: {
  winner: RaffleEntrant;
  isRedraw: boolean;
  poolSize: number;
  clock: ClaimClock;
}) {
  const { phase, seconds, totalSecs, bind } = clock;
  const off = totalSecs === 0;
  const low =
    phase !== "claimed" &&
    !off &&
    ((seconds <= Math.min(10, Math.ceil(totalSecs / 3)) && seconds > 0) ||
      phase === "done");

  let index = 0;
  const words = winner.fullName.split(" ").filter(Boolean);
  const settle = winner.fullName.length * LETTER_STAGGER_MS;
  const sub =
    phase === "done"
      ? "Redraw if they haven’t reached the stage"
      : phase === "claimed"
        ? ""
        : `${fmt(totalSecs)} to reach the stage`;

  const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

  return (
    <div className={styles.frame}>
    <div
      ref={bind}
      className={styles.scene}
      data-phase={phase}
      data-low={low}
      data-off={off}
    >
      <div className={styles.glow} />
      <div className={styles.dusk} />

      <div className={styles.copy}>
        <p
          className={`${styles.eyebrow} ${styles.later} ${isRedraw ? styles.redraw : ""}`}
          style={delay(0)}
        >
          {isRedraw ? "Redraw" : "Tonight’s winner"}
        </p>
        <h2 className={styles.name} aria-label={winner.fullName}>
          {words.map((word, w) => (
            <span key={w}>
              <span className={styles.word} aria-hidden>
                {[...word].map((letter, l) => (
                  <span
                    key={l}
                    className={styles.letter}
                    style={{ "--i": index++ } as CSSProperties}
                  >
                    {letter}
                  </span>
                ))}
              </span>
              {w < words.length - 1 ? " " : null}
            </span>
          ))}
        </h2>
        <p className={`${styles.detail} ${styles.later}`} style={delay(settle + 350)}>
          {winner.source === "faculty" ? (
            <>
              <span className={styles.pill}>Faculty</span>
              {winner.department?.trim() ? <span>{winner.department.trim()}</span> : null}
            </>
          ) : (
            entrantDetail(winner)
          )}
        </p>
        <p className={`${styles.eligible} ${styles.later}`} style={delay(settle + 450)}>
          Drawn from {poolSize} eligible
        </p>
      </div>

      <div className={styles.sunwin}>
        <div className={styles.sun} />
      </div>
      <div className={styles.horizon} />
      <div className={styles.reflect} />

      <div className={`${styles.below} ${styles.later}`} style={delay(settle + 550)}>
        {/* Keyed on the second so the pop restarts on every tick of the last stretch. */}
        <div
          key={low ? seconds : "steady"}
          className={`${styles.digits} ${low && phase === "running" ? styles.bump : ""}`}
          role="timer"
          aria-label={`${fmt(seconds)} left`}
        >
          {fmt(seconds)}
        </div>
        <div className={styles.status}>{STATUS[phase]}</div>
        <div className={styles.sub}>{sub}</div>
      </div>

    </div>
    </div>
  );
}
