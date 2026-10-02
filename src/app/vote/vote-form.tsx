"use client";

import { useActionState } from "react";
import { CROWD_CHOICE, type Act } from "@/lib/config/battle";
import { submitVote, type VoteState } from "./actions";
import { ActAvatar } from "./act-avatar";

const initial: VoteState = { status: "idle" };

const labelClass = "text-xs font-bold uppercase tracking-[0.2em] text-accent-2";

const glass = "rounded-xl border border-ground/15 bg-ground/10";

const inputClass =
  `${glass} w-full px-3.5 py-3 text-ground placeholder:text-ground/45 ` +
  "focus:border-accent-2 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2";

export function VoteForm() {
  const [state, action, pending] = useActionState(submitVote, initial);

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

  return (
    <form action={action} noValidate className="flex flex-col gap-6 text-left">
      {state.status === "error" && state.message ? (
        <p role="alert" className="rounded-xl border border-accent-4/50 bg-accent-4/15 px-4 py-3">
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClass}>
          Your name
        </label>
        <p className="text-sm text-ground/70">
          Use your real name, the one you registered with. Type it as Last name, First name, M.I.
          or First name, M.I., Last name.
        </p>
        <input
          id="name"
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={state.values?.name}
          placeholder="Dela Cruz, Juan M."
          className={inputClass}
        />
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
        disabled={pending}
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
