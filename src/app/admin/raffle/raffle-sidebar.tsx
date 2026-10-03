"use client";

import { useState } from "react";
import { entrantDetail } from "@/lib/raffle/pool";
import { drawablePool } from "@/lib/raffle/pool";
import type { RaffleDrawRow, RaffleEntrant } from "@/lib/raffle/types";
import {
  COUNTDOWN_MAX,
  COUNTDOWN_PRESETS,
  COUNTDOWN_STEP,
  type CountdownSettings,
} from "./countdown-settings";
import { EntrantManager } from "./entrant-manager";
import { Modal } from "../modal";
import { useFlash } from "../flash";

const PRESET_LABEL: Record<number, string> = { 0: "Off", 10: "10s", 30: "30s", 60: "1 min", 120: "2 min" };

const fmt = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

const chip =
  "min-h-10 min-w-12 rounded border px-3 text-sm font-semibold tabular-nums focus:outline-2 focus:outline-offset-2 focus:outline-accent-2";

/**
 * How long a winner has to reach the stage once their name is up. Adjustable
 * on the night: a quick 10s for a prize on the floor, a minute or two for a
 * big one. Remembered in this browser. Changing it mid-countdown applies on
 * the next draw, or on Restart.
 */
function CountdownControls({
  value,
  onChange,
}: {
  value: CountdownSettings;
  onChange: (next: CountdownSettings) => void;
}) {
  const set = (secs: number) =>
    onChange({ ...value, secs: Math.min(COUNTDOWN_MAX, Math.max(0, secs)) });

  return (
    <div className="flex flex-col gap-2 border-t border-ground/10 pt-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ground/50">
        Claim countdown
      </h2>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Countdown length">
        {COUNTDOWN_PRESETS.map((secs) => (
          <button
            key={secs}
            type="button"
            aria-pressed={value.secs === secs}
            onClick={() => set(secs)}
            className={`${chip} ${
              value.secs === secs
                ? "border-accent-2 bg-accent-2 text-deep"
                : "border-ground/25 bg-deep text-ground hover:border-ground/50"
            }`}
          >
            {PRESET_LABEL[secs]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${COUNTDOWN_STEP} seconds less`}
          onClick={() => set(value.secs - COUNTDOWN_STEP)}
          className={`${chip} border-ground/25 bg-deep text-lg hover:border-ground/50`}
        >
          −
        </button>
        <output className="min-w-16 text-center font-display text-2xl tabular-nums" aria-live="polite">
          {value.secs === 0 ? "Off" : fmt(value.secs)}
        </output>
        <button
          type="button"
          aria-label={`${COUNTDOWN_STEP} seconds more`}
          onClick={() => set(value.secs + COUNTDOWN_STEP)}
          className={`${chip} border-ground/25 bg-deep text-lg hover:border-ground/50`}
        >
          +
        </button>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.autoStart}
          onChange={(event) => onChange({ ...value, autoStart: event.target.checked })}
          className="mt-0.5 h-4 w-4"
        />
        Start as soon as the name shows
      </label>
      <p className="text-sm text-ground/50">
        The winner has this long to reach the stage. When it runs out, Redraw
        lights up. Nothing is redrawn for you.
      </p>
    </div>
  );
}

/**
 * The left column: everyone's eligibility (the count, the two toggles,
 * Setup) plus a running history of who's won so far. There's no prize list
 * here — the MC announces what's being raffled off verbally, so the app's
 * only job is names, in order. The show itself (the name roll, the reveal, the
 * Draw/Redraw action) lives in the main panel in raffle-projector.tsx.
 */
export function RaffleSidebar({
  draws,
  pool,
  onPoolChange,
  excludePreviousWinners,
  onToggleExclude,
  includeExtraEntrants,
  onToggleIncludeExtraEntrants,
  includeFaculty,
  onToggleIncludeFaculty,
  onReset,
  countdown,
  onCountdownChange,
  ticketsSold,
}: {
  draws: RaffleDrawRow[];
  pool: RaffleEntrant[];
  onPoolChange: (next: RaffleEntrant[]) => void;
  excludePreviousWinners: boolean;
  onToggleExclude: (next: boolean) => void;
  includeExtraEntrants: boolean;
  onToggleIncludeExtraEntrants: (next: boolean) => void;
  includeFaculty: boolean;
  onToggleIncludeFaculty: (next: boolean) => void;
  /** Clears every winner. Resolves true once they are gone. */
  onReset: () => Promise<boolean>;
  countdown: CountdownSettings;
  onCountdownChange: (next: CountdownSettings) => void;
  ticketsSold: number;
}) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const [resetting, setResetting] = useState(false);
  const flash = useFlash();
  const extras = pool.filter((entrant) => entrant.source === "extra");
  const facultyCount = pool.filter((entrant) => entrant.source === "faculty").length;
  const effectivePool = drawablePool(pool, {
    extraEntrants: includeExtraEntrants,
    faculty: includeFaculty,
  });
  const studentCount = effectivePool.filter((entrant) => entrant.source !== "faculty").length;

  const supersededIds = new Set(
    draws.map((row) => row.supersedes).filter((id): id is string => id !== null),
  );

  // One line per standing winner, in the order drawn. This is what gets copied
  // before a reset, since a reset cannot be undone.
  const winnerLines = draws
    .filter((row) => !supersededIds.has(row.id))
    .map((row, i) => `${i + 1}. ${row.winner.fullName} (${entrantDetail(row.winner)})`);

  async function copyWinners() {
    try {
      await navigator.clipboard.writeText(winnerLines.join("\n"));
      flash("Winners copied.");
    } catch {
      flash("Couldn't copy. Select the names and copy them by hand.", "error");
    }
  }

  async function confirmReset() {
    setResetting(true);
    const done = await onReset();
    setResetting(false);
    if (done) {
      setResetOpen(false);
      setResetText("");
    }
  }

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-ground/10 bg-black/20 py-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Show sidebar"
          className="rounded border border-ground/25 px-2 py-1.5 text-xs hover:border-ground/50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-4"
        >
          »
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-ground/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-ground/70">
          <span className="font-semibold text-ground">{effectivePool.length}</span>{" "}
          in the running
          <span className="block text-ground/50">
            {studentCount} of {ticketsSold} tickets
            {includeFaculty ? ` · ${facultyCount} faculty` : ""}
          </span>
          {!includeExtraEntrants && extras.length > 0 ? (
            <span className="block text-ground/50">
              ({extras.length} added name{extras.length === 1 ? "" : "s"} not
              included this draw)
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
          className="shrink-0 rounded border border-ground/25 px-2 py-1.5 text-xs hover:border-ground/50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-4"
        >
          «
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ground/50">
          Winners
        </h2>
        <ul className="flex flex-col gap-2">
          {[...draws]
            .reverse()
            .map((row) => {
              const replaced = supersededIds.has(row.id);
              return (
                <li
                  key={row.id}
                  className={`rounded border border-ground/15 px-3 py-2 ${replaced ? "opacity-40" : ""}`}
                >
                  <span
                    className={`block font-semibold ${replaced ? "line-through" : ""}`}
                  >
                    {row.winner.fullName}
                  </span>
                  <span className="block text-sm text-ground/60">
                    {entrantDetail(row.winner)}
                    {row.isRedraw ? " · redraw" : ""}
                    {replaced ? " · replaced" : ""}
                  </span>
                </li>
              );
            })}
          {draws.length === 0 ? (
            <li className="text-sm text-ground/50">No draws yet.</li>
          ) : null}
        </ul>
      </div>

      <div className="flex flex-col gap-3 border-t border-ground/10 pt-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={excludePreviousWinners}
            onChange={(event) => onToggleExclude(event.target.checked)}
            className="h-4 w-4"
          />
          Exclude anyone who already won
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeFaculty}
            onChange={(event) => onToggleIncludeFaculty(event.target.checked)}
            className="h-4 w-4"
          />
          Include faculty ({facultyCount})
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeExtraEntrants}
            onChange={(event) => onToggleIncludeExtraEntrants(event.target.checked)}
            className="h-4 w-4"
          />
          Include added names
        </label>
      </div>

      <CountdownControls value={countdown} onChange={onCountdownChange} />

      <button
        type="button"
        onClick={() => setResetOpen(true)}
        disabled={draws.length === 0}
        className="self-start rounded border border-accent-4/60 px-3 py-1.5 text-xs uppercase tracking-wide text-accent-4 hover:bg-accent-4/10 disabled:opacity-40 focus:outline-2 focus:outline-offset-2 focus:outline-accent-4"
      >
        Reset winners
      </button>

      <button
        type="button"
        onClick={() => setSetupOpen(true)}
        className="self-start rounded border border-ground/25 px-3 py-1.5 text-xs uppercase tracking-wide hover:border-ground/50"
      >
        Setup
      </button>

      <p className="text-sm text-ground/50">
        Students scanned in at the door can win. Faculty who acknowledged the
        invitation can too, whether or not they came. Nobody is scanned for
        them, so the emcee redraws on the spot if one is not in the room.
        Manage that list under Faculty. A scanner that has not synced yet is
        missing from the count above.
      </p>

      {resetOpen ? (
        <Modal
          title="Reset all winners?"
          onClose={() => {
            if (!resetting) setResetOpen(false);
          }}
        >
          <p className="text-sm text-ground/70">
            This clears all {draws.length} draw{draws.length === 1 ? "" : "s"} from the
            list, replaced no-shows included. It cannot be undone, and everyone is
            eligible again. Copy the winners first if you need the list.
          </p>
          <button
            type="button"
            onClick={copyWinners}
            className="self-start rounded border border-ground/25 px-3 py-1.5 text-xs uppercase tracking-wide hover:border-ground/50"
          >
            Copy winners
          </button>
          <label className="flex flex-col gap-1 text-sm">
            Type RESET to confirm
            <input
              value={resetText}
              onChange={(event) => setResetText(event.target.value)}
              autoComplete="off"
              className="rounded border border-ground/25 bg-deep px-3 py-2 uppercase"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={confirmReset}
              disabled={resetting || resetText.trim().toUpperCase() !== "RESET"}
              className="rounded-full bg-accent-4 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              {resetting ? "Resetting…" : "Reset winners"}
            </button>
            <button
              type="button"
              onClick={() => setResetOpen(false)}
              disabled={resetting}
              className="text-sm text-ground/70 hover:text-ground"
            >
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}

      {setupOpen ? (
        <Modal title="Setup" onClose={() => setSetupOpen(false)}>
          <EntrantManager
            extras={extras}
            onAdd={(entrant) => onPoolChange([...pool, entrant])}
            onAddMany={(entrants) => onPoolChange([...pool, ...entrants])}
            onRemove={(id) => onPoolChange(pool.filter((e) => e.registrationId !== id))}
          />
        </Modal>
      ) : null}
    </aside>
  );
}
