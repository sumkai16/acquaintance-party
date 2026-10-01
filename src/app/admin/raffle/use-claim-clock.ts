"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ClockPhase = "idle" | "ready" | "running" | "paused" | "done" | "claimed";

export type ClaimClock = {
  phase: ClockPhase;
  /** Whole seconds left, rounded up — what the big number shows. */
  seconds: number;
  /** Length of the countdown in seconds; 0 means there is none. */
  totalSecs: number;
  /** Ref callback for the element that carries the `--p` progress variable. */
  bind: (node: HTMLElement | null) => void;
  begin: (secs: number, autoStartAfterMs: number | null) => void;
  start: () => void;
  pause: () => void;
  restart: (secs: number) => void;
  claim: () => void;
  stop: () => void;
};

/**
 * The claim countdown for one winner.
 *
 * Time is measured against `performance.now()`, never counted in ticks, so a
 * busy frame or a throttled background tab can't make it run slow. The smooth
 * part — the sun sinking — is driven by writing `--p` (the fraction of time
 * left, 1 to 0) straight onto the scene element every frame; React only
 * re-renders when the whole second changes or the phase does, so the
 * animation never waits on a render.
 *
 * It never redraws anyone itself. Running out only changes the phase to
 * "done"; the operator decides what happens next.
 */
export function useClaimClock(): ClaimClock {
  const [phase, setPhaseState] = useState<ClockPhase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [totalSecs, setTotalSecs] = useState(0);

  const s = useRef({
    phase: "idle" as ClockPhase,
    totalMs: 0,
    spentMs: 0,
    startedAt: 0,
    running: false,
    raf: 0,
    timer: 0 as unknown as ReturnType<typeof setTimeout>,
    node: null as HTMLElement | null,
  });

  const setPhase = useCallback((next: ClockPhase) => {
    s.current.phase = next;
    setPhaseState(next);
  }, []);

  const paint = useCallback(() => {
    const c = s.current;
    const elapsed = c.spentMs + (c.running ? performance.now() - c.startedAt : 0);
    const left = Math.max(0, c.totalMs - elapsed);
    c.node?.style.setProperty("--p", (c.totalMs ? left / c.totalMs : 1).toFixed(4));
    setSeconds(Math.ceil(left / 1000));
    return left;
  }, []);

  const loop = useCallback(
    function tick() {
      const c = s.current;
      const left = paint();
      if (c.running && left === 0) {
        c.running = false;
        c.spentMs = c.totalMs;
        setPhase("done");
        return;
      }
      if (c.running) c.raf = requestAnimationFrame(tick);
    },
    [paint, setPhase],
  );

  const halt = useCallback(() => {
    const c = s.current;
    cancelAnimationFrame(c.raf);
    clearTimeout(c.timer);
    if (c.running) c.spentMs += performance.now() - c.startedAt;
    c.running = false;
  }, []);

  const start = useCallback(() => {
    const c = s.current;
    if (c.running || !c.totalMs || c.phase === "done" || c.phase === "claimed") return;
    c.running = true;
    c.startedAt = performance.now();
    setPhase("running");
    loop();
  }, [loop, setPhase]);

  const begin = useCallback(
    (secs: number, autoStartAfterMs: number | null) => {
      const c = s.current;
      halt();
      c.totalMs = secs * 1000;
      c.spentMs = 0;
      setTotalSecs(secs);
      setPhase("ready");
      paint();
      if (secs > 0 && autoStartAfterMs !== null) {
        c.timer = setTimeout(start, autoStartAfterMs);
      }
    },
    [halt, paint, setPhase, start],
  );

  const pause = useCallback(() => {
    if (!s.current.running) return;
    halt();
    setPhase("paused");
  }, [halt, setPhase]);

  const restart = useCallback(
    (secs: number) => {
      begin(secs, 0);
    },
    [begin],
  );

  const claim = useCallback(() => {
    const c = s.current;
    if (c.phase === "claimed") return;
    halt();
    setPhase("claimed");
    // After the claimed styles are in place, so the sun's rise is a transition
    // from where it stopped rather than a jump.
    requestAnimationFrame(() => c.node?.style.setProperty("--p", "1"));
  }, [halt, setPhase]);

  const stop = useCallback(() => {
    halt();
    s.current.totalMs = 0;
    setTotalSecs(0);
    setPhase("idle");
  }, [halt, setPhase]);

  const bind = useCallback(
    (node: HTMLElement | null) => {
      s.current.node = node;
      if (node) paint();
    },
    [paint],
  );

  useEffect(() => {
    const c = s.current;
    return () => {
      cancelAnimationFrame(c.raf);
      clearTimeout(c.timer);
    };
  }, []);

  return { phase, seconds, totalSecs, bind, begin, start, pause, restart, claim, stop };
}
