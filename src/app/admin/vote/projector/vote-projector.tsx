"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORIES, CROWD_CHOICE, type Act, type Category } from "@/lib/config/battle";
import { useSetNavHidden } from "../../admin-nav";
import { projectorStatus, type ProjectorStatus } from "../actions";

const POLL_MS = 5_000;

// Stage Lights: two spotlights from the top edge, built from the theme's own
// tokens (raspberry pink and sun gold) so nothing here is a loose hex.
const SPOTLIGHTS = [
  "radial-gradient(28cqw 60cqw at 20% -8%, color-mix(in srgb, var(--color-accent-4) 50%, transparent), transparent 70%)",
  "radial-gradient(28cqw 60cqw at 80% -8%, color-mix(in srgb, var(--color-accent-2) 42%, transparent), transparent 70%)",
].join(", ");

const GOLD_GLOW = "0 0 3cqw color-mix(in srgb, var(--color-accent-2) 75%, transparent)";
const PINK_GLOW = "0 0 3cqw color-mix(in srgb, var(--color-accent-4) 90%, transparent)";

export function VoteProjector({
  qr,
  voteUrl,
  initial,
}: {
  qr: string | null;
  voteUrl: string | null;
  initial: ProjectorStatus | null;
}) {
  useSetNavHidden(true);
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    let alive = true;
    const timer = setInterval(async () => {
      const result = await projectorStatus();
      // A failed poll keeps the last picture: a projector that blanks on a
      // blip of signal is worse than one a few seconds behind.
      if (alive && result.ok) setStatus(result.status);
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // Once either winner is out the screen changes to the two result cards; the
  // one not yet revealed stays a closed envelope until its own Reveal.
  const anyRevealed = CATEGORIES.some((category) => status?.winners[category]);

  return (
    <main className="@container relative isolate flex flex-1 flex-col items-center justify-center overflow-hidden px-8 py-10 text-center">
      <div aria-hidden className="absolute inset-0 -z-10 bg-black/35" style={{ backgroundImage: SPOTLIGHTS }} />

      <Link
        href="/admin/vote"
        className="absolute top-4 left-4 z-10 text-sm text-ground/25 hover:text-ground"
      >
        ← Back to controls
      </Link>

      <p className="text-[2.1cqw] font-semibold uppercase tracking-[0.2em] text-ground/75">
        Battle of the Beats
      </p>
      <h1
        className={`font-display uppercase text-white ${anyRevealed ? "text-[6cqw]" : "text-[8cqw]"}`}
        style={{ lineHeight: 1, textShadow: GOLD_GLOW }}
      >
        {CROWD_CHOICE.award}
      </h1>

      {anyRevealed && status ? (
        <div className="mt-[3cqw] grid w-full max-w-[92cqw] grid-cols-2 gap-[3cqw]">
          {CATEGORIES.map((category) => (
            <ResultCard key={category} category={category} winners={status.winners[category]} />
          ))}
        </div>
      ) : (
        <div className="mt-[3cqw] flex w-full items-center justify-center gap-[6cqw]">
          <p className="w-[22cqw] text-right text-[2.6cqw] font-semibold leading-tight">
            {status?.open ? "Scan to vote" : "Voting opens soon"}
          </p>
          {qr ? (
            // A data URL, nothing for next/image to optimise. The white card
            // keeps the quiet zone and black-on-white a camera needs from the
            // back of a room (context/DESIGN.md §4).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt={`QR code to vote, linking to ${voteUrl}`}
              className="w-[33cqw] shrink-0 rounded-[1.6cqw] bg-white p-[0.8cqw]"
              style={{
                boxShadow:
                  "0 0 6cqw color-mix(in srgb, var(--color-accent-4) 65%, transparent)",
              }}
            />
          ) : (
            <p className="w-[33cqw] shrink-0 text-[1.8cqw] text-ground/70">
              Set <code className="font-mono">NEXT_PUBLIC_SITE_URL</code> in Vercel and
              redeploy to show the QR. Voting is at <code className="font-mono">/vote</code>{" "}
              meanwhile.
            </p>
          )}
          <p className="w-[22cqw] text-left text-[2.6cqw] font-semibold leading-tight">
            <span className="block font-display text-[9cqw] font-normal leading-none tabular-nums">
              {status?.total ?? 0}
            </span>
            votes in
          </p>
        </div>
      )}

      {!anyRevealed && voteUrl ? (
        <p className="mt-[2cqw] font-mono text-[1.8cqw] text-ground/60">{voteUrl}</p>
      ) : null}
      {!anyRevealed && status && !status.open && status.total > 0 ? (
        <p className="mt-[1cqw] text-[2cqw] text-ground/60">Voting is closed</p>
      ) : null}
    </main>
  );
}

function ResultCard({ category, winners }: { category: Category; winners: Act[] | null }) {
  const label = CROWD_CHOICE[category].label;
  const revealed = winners !== null;

  return (
    <section
      className={`flex min-h-[26cqw] flex-col items-center justify-center rounded-[2cqw] border px-[2cqw] py-[3cqw] ${
        revealed ? "border-accent-4 bg-ground/10" : "border-ground/15 bg-ground/5"
      }`}
      style={revealed ? { boxShadow: "0 0 4cqw color-mix(in srgb, var(--color-accent-4) 45%, transparent)" } : undefined}
    >
      <h2 className="text-[2.3cqw] font-bold uppercase tracking-[0.3em] text-accent-2">
        Best {label.toLowerCase()}
      </h2>

      {!revealed ? (
        <>
          <p className="mt-[1.4cqw] font-display text-[9cqw] leading-none text-ground/30">?</p>
          <p className="mt-[1cqw] text-[2.2cqw] text-ground/60">And the winner is…</p>
        </>
      ) : winners.length === 0 ? (
        <p className="mt-[1.4cqw] text-[3cqw] text-ground/60">No votes</p>
      ) : (
        <>
          {winners.length > 1 ? (
            <p className="mt-[1cqw] text-[2.2cqw] font-semibold uppercase tracking-widest text-accent-4">
              It&apos;s a tie
            </p>
          ) : null}
          <ul className="mt-[1.4cqw] flex flex-col gap-[0.6cqw]">
            {winners.map((act) => (
              <li
                key={act.key}
                className="font-display uppercase text-white"
                style={{ fontSize: "7.6cqw", lineHeight: 1.02, textShadow: PINK_GLOW }}
              >
                {act.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
