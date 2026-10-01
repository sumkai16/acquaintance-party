"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * How long a winner has to reach the stage, and whether the clock starts by
 * itself when the name appears. Kept in this browser, not the database: it is
 * the operator's preference for the night, and a reload mid-programme (the
 * laptop sleeps) should not put it back to the default.
 */
export type CountdownSettings = { secs: number; autoStart: boolean };

export const COUNTDOWN_PRESETS = [0, 10, 30, 60, 120] as const;
export const COUNTDOWN_STEP = 5;
export const COUNTDOWN_MAX = 600;

const KEY = "raffle-countdown";
const DEFAULTS: CountdownSettings = { secs: 30, autoStart: true };
const DEFAULT_RAW = JSON.stringify(DEFAULTS);

// localStorage can be missing or throw (private window, blocked site data), so
// the live value is also held here and the page still works for the session.
let memory: string | null = null;
const listeners = new Set<() => void>();

function readRaw(): string {
  if (memory !== null) return memory;
  try {
    return localStorage.getItem(KEY) ?? DEFAULT_RAW;
  } catch {
    return DEFAULT_RAW;
  }
}

function parse(raw: string): CountdownSettings {
  try {
    const value = JSON.parse(raw) as Partial<CountdownSettings>;
    const secs = Number(value.secs);
    return {
      secs:
        Number.isFinite(secs) && secs >= 0 && secs <= COUNTDOWN_MAX
          ? Math.round(secs)
          : DEFAULTS.secs,
      autoStart:
        typeof value.autoStart === "boolean" ? value.autoStart : DEFAULTS.autoStart,
    };
  } catch {
    return DEFAULTS;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCountdownSettings(): [
  CountdownSettings,
  (next: CountdownSettings) => void,
] {
  // The raw string is the snapshot: it is stable between reads, so React only
  // re-renders when the stored value actually changes.
  const raw = useSyncExternalStore(subscribe, readRaw, () => DEFAULT_RAW);
  const settings = useMemo(() => parse(raw), [raw]);

  const update = useCallback((next: CountdownSettings) => {
    const clean = parse(JSON.stringify(next));
    memory = JSON.stringify(clean);
    try {
      localStorage.setItem(KEY, memory);
    } catch {
      // Held in memory for this session only.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [settings, update];
}
