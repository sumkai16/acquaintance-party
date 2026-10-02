"use client";

import { useEffect, useState, useTransition } from "react";
import type { TallyRow } from "@/lib/votes/ballot";
import { CATEGORIES, CROWD_CHOICE, type Category } from "@/lib/config/battle";
import { useFlash } from "../flash";
import { Modal } from "../modal";
import { Stat } from "../stat";
import {
  adminVoteStatus,
  toggleReveal,
  toggleVoting,
  type AdminVoteStatus,
} from "./actions";

const POLL_MS = 5_000;

type Confirming = "voting" | Category | null;

export function VotePanel({ initial }: { initial: AdminVoteStatus }) {
  const [status, setStatus] = useState(initial);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [isSaving, startTransition] = useTransition();
  const flash = useFlash();

  // One poll for the one admin screen — the count is read here, never by the
  // students' phones, so this is the whole read load of "watching the vote".
  useEffect(() => {
    let alive = true;
    const timer = setInterval(async () => {
      const result = await adminVoteStatus();
      if (alive && result.ok) setStatus(result.status);
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  function confirm() {
    const target = confirming;
    if (!target) return;
    startTransition(async () => {
      const result =
        target === "voting"
          ? await toggleVoting(!status.open)
          : await toggleReveal(target, !status.revealed[target]);
      setConfirming(null);
      if (!result.ok) {
        flash(result.error, "error");
        return;
      }
      const fresh = await adminVoteStatus();
      if (fresh.ok) setStatus(fresh.status);
      flash(doneMessage(target, status));
    });
  }

  const showing = CATEGORIES.filter((category) => status.revealed[category]).length;

  return (
    <>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Votes cast" value={status.tally.total} />
        <Stat label="Voting" value={status.open ? "Open" : "Closed"} />
        <Stat label="Band winner" value={status.revealed.band ? "Showing" : "Hidden"} />
        <Stat label="Solo winner" value={status.revealed.solo ? "Showing" : "Hidden"} />
      </dl>

      <section className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-ground/10 bg-ground/5 p-4">
        <button
          type="button"
          onClick={() => setConfirming("voting")}
          disabled={isSaving}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          {status.open ? "Close voting" : "Open voting"}
        </button>
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setConfirming(category)}
            disabled={isSaving}
            className="rounded-full bg-accent-2 px-5 py-2.5 text-sm font-semibold text-deep hover:opacity-90 disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
          >
            {status.revealed[category] ? "Hide" : "Reveal"}{" "}
            {CROWD_CHOICE[category].label.toLowerCase()} winner
          </button>
        ))}
        <p className="basis-full text-sm text-ground/60">
          Close voting before you reveal, so the result can&apos;t change on stage. The
          projector shows {showing === 0 ? "the QR and the vote count" : `${showing} of 2 winners`}.
        </p>
      </section>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Results title={CROWD_CHOICE.band.label} rows={status.tally.band} />
        <Results title={CROWD_CHOICE.solo.label} rows={status.tally.solo} />
      </div>

      {confirming ? (
        <Modal
          title={confirmTitle(confirming, status)}
          onClose={() => {
            if (!isSaving) setConfirming(null);
          }}
        >
          <p className="text-sm text-ground/70">{confirmBody(confirming, status)}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={confirm}
              disabled={isSaving}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              {isSaving ? "Saving…" : confirmTitle(confirming, status).replace("?", "")}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => setConfirming(null)}
              disabled={isSaving}
              className="text-sm font-semibold text-ground/60 hover:text-ground disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function labelOf(category: Category): string {
  return CROWD_CHOICE[category].label.toLowerCase();
}

function confirmTitle(target: Exclude<Confirming, null>, status: AdminVoteStatus): string {
  if (target === "voting") return status.open ? "Close voting?" : "Open voting?";
  return status.revealed[target]
    ? `Hide ${labelOf(target)} winner?`
    : `Reveal ${labelOf(target)} winner?`;
}

function confirmBody(target: Exclude<Confirming, null>, status: AdminVoteStatus): string {
  if (target === "voting") {
    return status.open
      ? "Students can no longer submit a vote. Votes already cast are kept."
      : "Students who scan the QR can vote right away. Open it after the last act.";
  }
  return status.revealed[target]
    ? `The projector goes back to showing a closed envelope for the ${labelOf(target)}.`
    : `The projector shows the ${labelOf(target)} winner right away. Voting stays as it is, so close it first if it is still open.`;
}

function doneMessage(target: Exclude<Confirming, null>, before: AdminVoteStatus): string {
  if (target === "voting") return before.open ? "Voting closed." : "Voting is open.";
  return before.revealed[target]
    ? `${CROWD_CHOICE[target].label} winner hidden.`
    : `${CROWD_CHOICE[target].label} winner is showing on the projector.`;
}

function Results({ title, rows }: { title: string; rows: TallyRow[] }) {
  const top = Math.max(1, ...rows.map((row) => row.votes));
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{row.name}</span>
              <span className="tabular-nums text-ground/70">{row.votes}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ground/10">
              <div
                className="h-full rounded-full bg-accent-2"
                style={{ width: `${(row.votes / top) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
