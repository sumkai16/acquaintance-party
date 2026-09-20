"use client";

import { useState } from "react";
import Link from "next/link";
import { entrantDetail } from "@/lib/raffle/pool";
import type { RaffleAudience, RaffleDrawRow, RaffleEntrant } from "@/lib/raffle/types";
import { EntrantManager } from "./entrant-manager";
import { Modal } from "../modal";

const AUDIENCES = [
  { value: "student", label: "Students", href: "/admin/raffle" },
  { value: "faculty", label: "Faculty", href: "/admin/raffle?audience=faculty" },
] as const;

/**
 * Which pool is about to be drawn from, as two big tabs at the very top of
 * the sidebar rather than a dropdown buried in the toggles.
 *
 * Drawing from the wrong pool in front of a room is not a recoverable
 * mistake — the name is already announced by the time anyone notices — so
 * this is deliberately the loudest control on the screen.
 */
function AudienceTabs({ audience }: { audience: RaffleAudience }) {
  return (
    <div className="flex gap-1 rounded-full border border-ground/20 p-1">
      {AUDIENCES.map((option) => {
        const active = option.value === audience;
        return (
          <Link
            key={option.value}
            href={option.href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 rounded-full px-3 py-1.5 text-center text-sm font-semibold transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 ${
              active
                ? "bg-accent text-white"
                : "text-ground/60 hover:bg-ground/10 hover:text-ground"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * The left column: everyone's eligibility (the count, the two toggles,
 * Setup) plus a running history of who's won so far. There's no prize list
 * here — the MC announces what's being raffled off verbally, so the app's
 * only job is names, in order. The show itself (the wheel, the reveal, the
 * Draw/Redraw action) lives in the main panel in raffle-projector.tsx.
 */
export function RaffleSidebar({
  audience,
  draws,
  pool,
  onPoolChange,
  excludePreviousWinners,
  onToggleExclude,
  includeExtraEntrants,
  onToggleIncludeExtraEntrants,
  ticketsSold,
}: {
  audience: RaffleAudience;
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
  const [collapsed, setCollapsed] = useState(false);
  const isFaculty = audience === "faculty";
  const extras = pool.filter((entrant) => entrant.source === "extra");
  const effectivePool =
    isFaculty || includeExtraEntrants
      ? pool
      : pool.filter((entrant) => entrant.source === "ticket");

  const supersededIds = new Set(
    draws.map((row) => row.supersedes).filter((id): id is string => id !== null),
  );

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
      <AudienceTabs audience={audience} />

      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-ground/70">
          <span className="font-semibold text-ground">{effectivePool.length}</span>{" "}
          {isFaculty
            ? `faculty entered`
            : `eligible of ${ticketsSold} tickets sold`}
          {!isFaculty && !includeExtraEntrants && extras.length > 0 ? (
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
          Exclude {isFaculty ? "faculty" : "students"} who already won
        </label>
        {/* Setup and its added names belong to the ticket pool. A faculty
            entrant only ever arrives by acknowledging the invitation, so
            there is no second way in to opt into here. */}
        {!isFaculty ? (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeExtraEntrants}
              onChange={(event) => onToggleIncludeExtraEntrants(event.target.checked)}
              className="h-4 w-4"
            />
            Include added names
          </label>
        ) : null}
      </div>

      {!isFaculty ? (
        <button
          type="button"
          onClick={() => setSetupOpen(true)}
          className="self-start rounded border border-ground/25 px-3 py-1.5 text-xs uppercase tracking-wide hover:border-ground/50"
        >
          Setup
        </button>
      ) : null}

      <p className="text-sm text-ground/50">
        {isFaculty
          ? "Every faculty member who acknowledged the invitation can win, whether or not they came — nobody is scanned at the door. Manage the list under Faculty."
          : "Students scanned in at the door can win — turn on “Include added names” to pull in anyone added under Setup. A scanner that has not synced yet is missing from the count above."}
      </p>

      {setupOpen && !isFaculty ? (
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
