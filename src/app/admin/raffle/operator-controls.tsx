"use client";

import { RAFFLE_PRIZES } from "@/lib/config/event";
import { latestDrawForPrize } from "@/lib/raffle/draw";
import type { RaffleDrawRow } from "@/lib/raffle/types";

/**
 * What the operator at the laptop sees between prizes. Hidden while a draw
 * is animating so nothing admin-looking lands on the projector mid-show.
 */
export function OperatorControls({
  draws,
  selectedKey,
  onSelect,
  excludePreviousWinners,
  onToggleExclude,
  eligible,
  ticketsSold,
  pending,
  error,
  onDraw,
  onRedraw,
}: {
  draws: RaffleDrawRow[];
  selectedKey: string;
  onSelect: (key: string) => void;
  excludePreviousWinners: boolean;
  onToggleExclude: (next: boolean) => void;
  eligible: number;
  ticketsSold: number;
  pending: boolean;
  error: string | null;
  onDraw: () => void;
  onRedraw: (supersedesDrawId: string) => void;
}) {
  const standing = latestDrawForPrize(draws, selectedKey);

  return (
    <div className="border-t border-night-ink/15 bg-night-deep/60 px-6 py-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-night-ink/70">
          <p>
            <span className="font-semibold text-night-ink">{eligible}</span>{" "}
            eligible of {ticketsSold} tickets sold
          </p>
          <p className="text-night-ink/50">
            Only students scanned in at the door can win. A scanner that has
            not synced yet is missing from this count.
          </p>
        </div>

        <ul className="flex flex-wrap gap-2">
          {RAFFLE_PRIZES.map((prize) => {
            const drawn = latestDrawForPrize(draws, prize.key);
            const selected = prize.key === selectedKey;

            return (
              <li key={prize.key}>
                <button
                  type="button"
                  onClick={() => onSelect(prize.key)}
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
              disabled={pending || eligible === 0}
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
