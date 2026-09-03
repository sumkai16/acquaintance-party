"use client";

import { useState } from "react";
import type { RaffleDrawRow, RaffleEntrant } from "@/lib/raffle/types";
import { EntrantManager } from "./entrant-manager";

/**
 * The left column: everyone's eligibility (the count, the two toggles,
 * Setup) plus a running history of who's won so far. There's no prize list
 * here — the MC announces what's being raffled off verbally, so the app's
 * only job is names, in order. The show itself (the wheel, the reveal, the
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
  ticketsSold,
}: {
  draws: RaffleDrawRow[];
  pool: RaffleEntrant[];
  onPoolChange: (next: RaffleEntrant[]) => void;
  excludePreviousWinners: boolean;
  onToggleExclude: (next: boolean) => void;
  includeExtraEntrants: boolean;
  onToggleIncludeExtraEntrants: (next: boolean) => void;
  ticketsSold: number;
}) {
  const [setupOpen, setSetupOpen] = useState(false);
  const extras = pool.filter((entrant) => entrant.source === "extra");
  const effectivePool = includeExtraEntrants
    ? pool
    : pool.filter((entrant) => entrant.source === "ticket");

  const supersededIds = new Set(
    draws.map((row) => row.supersedes).filter((id): id is string => id !== null),
  );

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
                    {row.winner.yearLevel} · {row.winner.section}
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
        <div className="rounded border border-ground/15 bg-deep/30 p-4">
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
