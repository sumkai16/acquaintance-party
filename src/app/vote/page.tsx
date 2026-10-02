import { EVENT } from "@/lib/config/event";
import { CROWD_CHOICE } from "@/lib/config/battle";
import { votingOpen } from "@/lib/settings/queries";
import { VoteForm } from "./vote-form";

export const metadata = { title: `${CROWD_CHOICE.award} · ${EVENT.name}` };

// Whether voting is open changes during the night; a build-time copy of this
// page would say "closed" forever.
export const dynamic = "force-dynamic";

// Stage Lights, the look the committee picked for the ballot and the projector:
// two spotlights from the top edge, built from the theme's own tokens.
const SPOTLIGHTS = [
  "radial-gradient(160px 280px at 18% 0, color-mix(in srgb, var(--color-accent-4) 55%, transparent), transparent 70%)",
  "radial-gradient(160px 280px at 82% 0, color-mix(in srgb, var(--color-accent-2) 45%, transparent), transparent 70%)",
].join(", ");

/**
 * The Crowd's Choice ballot, opened from the QR on the projector. Public and
 * unauthenticated — see actions.ts for how a voter is identified and
 * 0026_crowds_choice.sql for the one-vote rule. Dark on purpose, to match the
 * projector; context/DESIGN.md §3 has the row for it. The act photos go through
 * next/image (act-avatar.tsx) because hundreds of phones open this in the same
 * minute.
 */
export default async function VotePage() {
  const open = await votingOpen();

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-deep text-ground">
      <div aria-hidden className="absolute inset-0 -z-10 bg-black/35" />
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-80" style={{ backgroundImage: SPOTLIGHTS }} />

      <div className="mx-auto flex w-full max-w-md flex-col px-5 py-10">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-ground/75">
          Battle of the Beats
        </p>
        <h1
          className="mt-2 text-center font-display text-5xl uppercase text-white"
          style={{
            lineHeight: 1,
            textShadow: "0 0 22px color-mix(in srgb, var(--color-accent-2) 70%, transparent)",
          }}
        >
          {CROWD_CHOICE.award}
        </h1>

        {open ? (
          <>
            <p className="mt-3 text-center text-ground/80">
              Who owned the stage? Pick your favourite band and your favourite solo act.
              One vote each, and you can&apos;t change it after you submit.
            </p>
            <div className="mt-8">
              <VoteForm />
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-xl border border-ground/15 bg-ground/10 p-5 text-center">
            <p className="font-bold">Voting isn&apos;t open right now.</p>
            <p className="mt-2 text-ground/75">
              It opens after the last act. Reload this page when the emcee says go.
            </p>
            {/* A plain link, not a client refresh: it is the whole interaction,
                and a full reload is what re-reads the switch. */}
            <a
              href="/vote"
              className="mt-4 inline-block rounded-full bg-gradient-to-r from-accent to-accent-4 px-6 py-3 font-semibold uppercase tracking-wide text-white hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              Check again
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
