"use client";

import { useActionState, useEffect, useState } from "react";
import { CROWD_CHOICE, type Act } from "@/lib/config/battle";
import { MIN_QUERY_LENGTH, type VoterChoice } from "@/lib/votes/voters";
import { submitVote, type VoteState } from "./actions";
import { ActAvatar } from "./act-avatar";

const initial: VoteState = { status: "idle" };

const SEARCH_DELAY_MS = 250;

const labelClass = "text-xs font-bold uppercase tracking-[0.2em] text-accent-2";

const glass = "rounded-xl border border-ground/15 bg-ground/10";

const inputClass =
  `${glass} w-full px-3.5 py-3 text-ground placeholder:text-ground/45 ` +
  "focus:border-accent-2 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2";

export function VoteForm() {
  const [state, action, pending] = useActionState(submitVote, initial);

  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<VoterChoice | null>(null);
  const [results, setResults] = useState<VoterChoice[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "done" | "error">("idle");

  // Wait for a pause in typing, and drop the answer to a query that has
  // since been typed over. Hundreds of phones share one server: a request
  // per keystroke is exactly the load this is here to avoid.
  useEffect(() => {
    if (picked || query.trim().length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchState("loading");
      try {
        const response = await fetch(`/api/vote/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("search failed");
        const body = (await response.json()) as { results: VoterChoice[] };
        setResults(body.results);
        setSearchState("done");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setSearchState("error");
      }
    }, SEARCH_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, picked]);

  if (state.status === "voted") {
    const band = actFor(CROWD_CHOICE.band.acts, state.values?.band);
    const solo = actFor(CROWD_CHOICE.solo.acts, state.values?.solo);
    return (
      <div role="status" className={`${glass} p-5 text-center`}>
        <p className="font-display text-3xl uppercase text-white">{state.message}</p>
        {band && solo ? (
          <div className="mt-4 flex justify-center gap-6">
            {[band, solo].map((act) => (
              <div key={act.key} className="flex flex-col items-center gap-2">
                <ActAvatar act={act} />
                <span className="text-sm font-bold">{act.name}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="mt-4 text-ground/75">The winners are announced on stage.</p>
      </div>
    );
  }

  const tooShort = query.trim().length < MIN_QUERY_LENGTH;

  return (
    <form action={action} noValidate className="flex flex-col gap-6 text-left">
      {state.status === "error" && state.message ? (
        <p role="alert" className="rounded-xl border border-accent-4/50 bg-accent-4/15 px-4 py-3">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name-search" className={labelClass}>
          Your name
        </label>

        {picked ? (
          <div className={`${glass} flex items-center justify-between gap-3 px-3.5 py-3`}>
            <span>
              <span className="font-bold">{picked.fullName}</span>
              <span className="block text-sm text-ground/70">
                {picked.yearLevel} · {picked.section}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setPicked(null);
                setResults([]);
                setSearchState("idle");
              }}
              className="shrink-0 py-2 text-sm font-semibold text-accent-2 underline focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              Not me
            </button>
          </div>
        ) : (
          <>
            <input
              id="name-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Start typing your name"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={inputClass}
            />
            <ul className="flex flex-col gap-1.5" aria-live="polite">
              {!tooShort && searchState === "done" && results.length === 0 ? (
                <li className="text-sm text-ground/70">
                  No match. Only people scanned in at the door can vote. If you just
                  arrived, try again in a minute.
                </li>
              ) : null}
              {searchState === "error" && !tooShort ? (
                <li className="text-sm text-accent-2">
                  Search isn&apos;t working right now. Try again in a moment.
                </li>
              ) : null}
              {!tooShort
                ? results.map((voter) => (
                    <li key={`${voter.fullName}|${voter.yearLevel}|${voter.section}`}>
                      <button
                        type="button"
                        onClick={() => setPicked(voter)}
                        className={`${glass} w-full px-3.5 py-3 text-left hover:border-accent-2 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2`}
                      >
                        <span className="font-bold">{voter.fullName}</span>
                        <span className="block text-sm text-ground/70">
                          {voter.yearLevel} · {voter.section}
                        </span>
                      </button>
                    </li>
                  ))
                : null}
            </ul>
          </>
        )}
        <input type="hidden" name="name" value={picked?.fullName ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={labelClass}>
          Your email
        </label>
        <p className="text-sm text-ground/70">
          The email you registered with. It proves the name is yours.
        </p>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={state.values?.email}
          placeholder="juan@example.com"
          className={inputClass}
        />
      </div>

      <ActGrid
        legend={`Best ${CROWD_CHOICE.band.label.toLowerCase()}`}
        name="band"
        acts={CROWD_CHOICE.band.acts}
        selected={state.values?.band}
      />
      <ActGrid
        legend={`Best ${CROWD_CHOICE.solo.label.toLowerCase()}`}
        name="solo"
        acts={CROWD_CHOICE.solo.acts}
        selected={state.values?.solo}
      />

      <button
        type="submit"
        disabled={pending || !picked}
        className="rounded-full bg-gradient-to-r from-accent to-accent-4 px-6 py-3.5 font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      >
        {pending ? "Sending…" : "Submit my vote"}
      </button>
    </form>
  );
}

/**
 * One category as a grid of act tiles. Each tile is a label around a real
 * (visually hidden) radio, so keyboard and screen-reader use is the platform's
 * own; the lit state is CSS `:has(input:checked)` in globals.css. An odd last
 * act takes the full row rather than sitting alone in a half-empty one.
 */
function ActGrid({
  legend,
  name,
  acts,
  selected,
}: {
  legend: string;
  name: string;
  acts: readonly Act[];
  selected?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`${labelClass} mb-1`}>{legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {acts.map((act, index) => {
          const wide = acts.length % 2 === 1 && index === acts.length - 1;
          return (
            <label
              key={act.key}
              className={`vote-tile relative flex cursor-pointer items-center gap-3 rounded-2xl border border-ground/15 bg-ground/5 p-3 font-bold ${
                wide ? "col-span-2 flex-row" : "flex-col text-center"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={act.key}
                defaultChecked={selected === act.key}
                className="sr-only"
              />
              <ActAvatar act={act} />
              <span>{act.name}</span>
              <span aria-hidden className="vote-eq absolute top-2.5 right-2.5 h-3.5 items-end gap-0.5">
                <i />
                <i />
                <i />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function actFor(acts: readonly Act[], key: string | undefined): Act | undefined {
  return acts.find((act) => act.key === key);
}
