"use client";

import { useState } from "react";
import { latestDrawForPrize } from "@/lib/raffle/draw";
import type { RaffleDrawRow, RaffleEntrant, RafflePrize } from "@/lib/raffle/types";
import { EntrantManager } from "./entrant-manager";
import { PrizeManager } from "./prize-manager";

/**
 * What the operator at the laptop sees between prizes. Hidden while a draw
 * is animating so nothing admin-looking lands on the projector mid-show.
 */
export function OperatorControls({
  draws,
  prizes,
  onPrizesChange,
  pool,
  onPoolChange,
  selectedKey,
  onSelect,
  excludePreviousWinners,
  onToggleExclude,
  onlyScannedTickets,
  onToggleOnlyScannedTickets,
  ticketsSold,
  pending,
  error,
  onDraw,
  onRedraw,
}: {
  draws: RaffleDrawRow[];
  prizes: RafflePrize[];
  onPrizesChange: (next: RafflePrize[]) => void;
  pool: RaffleEntrant[];
  onPoolChange: (next: RaffleEntrant[]) => void;
  selectedKey: string;
  onSelect: (key: string) => void;
  excludePreviousWinners: boolean;
  onToggleExclude: (next: boolean) => void;
  onlyScannedTickets: boolean;
  onToggleOnlyScannedTickets: (next: boolean) => void;
  ticketsSold: number;
  pending: boolean;
  error: string | null;
  onDraw: () => void;
  onRedraw: (supersedesDrawId: string) => void;
}) {
  const [setupOpen, setSetupOpen] = useState(prizes.length === 0);
  const standing = latestDrawForPrize(draws, selectedKey);
  const extras = pool.filter((entrant) => entrant.source === "extra");
  // The pool this draw would actually use — the toggle below is per-draw,
  // so the count and the Draw button need to reflect it live, not the full
  // pool including names that this draw won't touch.
  const effectivePool = onlyScannedTickets
    ? pool.filter((entrant) => entrant.source === "ticket")
    : pool;

  return (
    <div className="border-t border-night-ink/15 bg-night-deep/60 px-6 py-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-night-ink/70">
          <p>
            <span className="font-semibold text-night-ink">{effectivePool.length}</span>{" "}
            eligible of {ticketsSold} tickets sold
            {onlyScannedTickets && extras.length > 0 ? (
              <span className="text-night-ink/50">
                {" "}
                ({extras.length} added name{extras.length === 1 ? "" : "s"} excluded
                this draw)
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => setSetupOpen((open) => !open)}
            className="rounded border border-night-ink/25 px-3 py-1.5 text-xs uppercase tracking-wide hover:border-night-ink/50"
          >
            {setupOpen ? "Hide setup" : "Setup"}
          </button>
        </div>

        {setupOpen ? (
          <div className="grid gap-6 rounded border border-night-ink/15 bg-night-ground/30 p-4 md:grid-cols-2">
            <PrizeManager
              prizes={prizes}
              onChange={onPrizesChange}
              hasDraw={(id) => latestDrawForPrize(draws, id) !== null}
            />
            <EntrantManager
              extras={extras}
              onAdd={(entrant) => onPoolChange([...pool, entrant])}
              onAddMany={(entrants) => onPoolChange([...pool, ...entrants])}
              onRemove={(id) => onPoolChange(pool.filter((e) => e.registrationId !== id))}
            />
          </div>
        ) : (
          <p className="text-night-ink/50">
            Students scanned in at the door can win, plus any names added
            under Setup — unless “Only scanned QR tickets” is on below. A
            scanner that has not synced yet is missing from this count.
          </p>
        )}

        <ul className="flex flex-wrap gap-2">
          {prizes.map((prize) => {
            const drawn = latestDrawForPrize(draws, prize.id);
            const selected = prize.id === selectedKey;

            return (
              <li key={prize.id}>
                <button
                  type="button"
                  onClick={() => onSelect(prize.id)}
                  className={`rounded border px-4 py-2 text-left transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-night-accent-3 ${
                    selected
                      ? "border-night-accent-3 bg-night-accent-3/15"
                      : "border-night-ink/25 hover:border-night-ink/50"
                  }`}
                >
                  <span className="block font-semibold">{prize.name}</span>
                  <span className="block text-sm text-night-ink/60">
                    {drawn
                      ? `${drawn.isRedraw ? "Redrawn — " : ""}${drawn.winner.fullName}`
                      : "Not drawn"}
                  </span>
                </button>
              </li>
            );
          })}
          {prizes.length === 0 ? (
            <li className="text-sm text-night-ink/50">
              Add a prize under Setup to start drawing.
            </li>
          ) : null}
        </ul>

        <div className="flex flex-wrap items-center gap-4">
          {standing ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (
                  window.confirm(
                    `Redraw ${standing.prizeName}? ${standing.winner.fullName} will be recorded as replaced, not erased.`,
                  )
                ) {
                  onRedraw(standing.id);
                }
              }}
              className="rounded bg-night-accent-2 px-6 py-3 font-semibold uppercase tracking-wide text-night-ground transition-opacity hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-night-ink disabled:opacity-50"
            >
              {pending ? "Drawing…" : "Redraw"}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || effectivePool.length === 0 || !selectedKey}
              onClick={onDraw}
              className="rounded bg-night-accent-2 px-6 py-3 font-semibold uppercase tracking-wide text-night-ground transition-opacity hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-night-ink disabled:opacity-50"
            >
              {pending ? "Drawing…" : "Draw"}
            </button>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={excludePreviousWinners}
              onChange={(event) => onToggleExclude(event.target.checked)}
              className="h-4 w-4"
            />
            Exclude students who already won
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyScannedTickets}
              onChange={(event) => onToggleOnlyScannedTickets(event.target.checked)}
              className="h-4 w-4"
            />
            Only scanned QR tickets
          </label>
        </div>

        {error ? (
          <p className="rounded border border-night-accent-2/50 bg-night-accent-2/10 px-4 py-3">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
