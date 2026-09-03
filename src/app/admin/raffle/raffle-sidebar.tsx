"use client";

import { useState } from "react";
import { latestDrawForPrize } from "@/lib/raffle/draw";
import type { RaffleDrawRow, RaffleEntrant, RafflePrize } from "@/lib/raffle/types";
import { EntrantManager } from "./entrant-manager";
import { PrizeManager } from "./prize-manager";

/**
 * The left column: everything about deciding what to draw next — pick a
 * prize, configure who's eligible. The show itself (the wheel, the reveal,
 * the Draw/Redraw button) lives in the main panel in raffle-projector.tsx,
 * not here — this is "configuring the draw," that's "running the show."
 */
export function RaffleSidebar({
  draws,
  prizes,
  onPrizesChange,
  pool,
  onPoolChange,
  selectedKey,
  onSelect,
  excludePreviousWinners,
  onToggleExclude,
  includeExtraEntrants,
  onToggleIncludeExtraEntrants,
  ticketsSold,
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
  includeExtraEntrants: boolean;
  onToggleIncludeExtraEntrants: (next: boolean) => void;
  ticketsSold: number;
}) {
  const [setupOpen, setSetupOpen] = useState(prizes.length === 0);
  const extras = pool.filter((entrant) => entrant.source === "extra");
  const effectivePool = includeExtraEntrants
    ? pool
    : pool.filter((entrant) => entrant.source === "ticket");

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-r border-ground/10 bg-black/20 p-4">
      <p className="text-sm text-ground/70">
        <span className="font-semibold text-ground">{effectivePool.length}</span>{" "}
        eligible of {ticketsSold} tickets sold
        {!includeExtraEntrants && extras.length > 0 ? (
          <span className="block text-ground/50">
            ({extras.length} added name{extras.length === 1 ? "" : "s"} not
            included this draw)
          </span>
        ) : null}
      </p>

      <ul className="flex flex-col gap-2">
        {prizes.map((prize) => {
          const drawn = latestDrawForPrize(draws, prize.id);
          const selected = prize.id === selectedKey;

          return (
            <li key={prize.id}>
              <button
                type="button"
                onClick={() => onSelect(prize.id)}
                className={`w-full rounded border px-4 py-3 text-left transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-accent-4 ${
                  selected
                    ? "border-accent-4 bg-accent-4/15"
                    : "border-ground/25 hover:border-ground/50"
                }`}
              >
                <span className="block font-semibold">{prize.name}</span>
                <span className="block text-sm text-ground/60">
                  {drawn
                    ? `${drawn.isRedraw ? "Redrawn — " : ""}${drawn.winner.fullName}`
                    : "Not drawn"}
                </span>
              </button>
            </li>
          );
        })}
        {prizes.length === 0 ? (
          <li className="text-sm text-ground/50">
            Add a prize under Setup to start drawing.
          </li>
        ) : null}
      </ul>

      <div className="flex flex-col gap-3 border-t border-ground/10 pt-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={excludePreviousWinners}
            onChange={(event) => onToggleExclude(event.target.checked)}
            className="h-4 w-4"
          />
          Exclude students who already won
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

      <button
        type="button"
        onClick={() => setSetupOpen((open) => !open)}
        className="self-start rounded border border-ground/25 px-3 py-1.5 text-xs uppercase tracking-wide hover:border-ground/50"
      >
        {setupOpen ? "Hide setup" : "Setup"}
      </button>

      {setupOpen ? (
        <div className="flex flex-col gap-6 rounded border border-ground/15 bg-deep/30 p-4">
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
        <p className="text-sm text-ground/50">
          Students scanned in at the door can win — turn on “Include added
          names” to pull in anyone added under Setup. A scanner that has not
          synced yet is missing from the count above.
        </p>
      )}
    </aside>
  );
}
