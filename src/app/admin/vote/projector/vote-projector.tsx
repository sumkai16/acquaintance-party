"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CATEGORIES, CROWD_CHOICE, type Act, type Category } from "@/lib/config/battle";
import { actInitials } from "@/lib/votes/acts";
import { useSetNavHidden } from "../../admin-nav";
import { projectorStatus, type ProjectorStatus } from "../actions";

const POLL_MS = 5_000;
// Once voting is closed the next thing is a Reveal, and the roulette should
// start close to the click. Only this one screen polls, so the cost is nothing.
const REVEAL_POLL_MS = 2_000;

// The spotlight roulette: a pause, hops that start fast and slow down, then a
// beat on the landed act before the name comes up. About six seconds in all.
const LEAD_MS = 700;
const FIRST_HOP_MS = 70;
const SLOWDOWN = 1.14;
const FAST_HOPS = 10;
const MIN_HOPS = 24;
const LAND_MS = 1_300;

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
  // Categories whose roulette is playing. Only a reveal this screen sees happen
  // spins; a projector opened or refreshed after it shows the result directly.
  const [spinning, setSpinning] = useState<Category[]>([]);
  const last = useRef(initial);

  const pollMs = status && !status.open ? REVEAL_POLL_MS : POLL_MS;

  useEffect(() => {
    let alive = true;
    const timer = setInterval(async () => {
      const result = await projectorStatus();
      // A failed poll keeps the last picture: a projector that blanks on a
      // blip of signal is worse than one a few seconds behind.
      if (!alive || !result.ok) return;
      const fresh = result.status;
      const newly = CATEGORIES.filter(
        (category) => !last.current?.winners[category] && fresh.winners[category]?.length,
      );
      last.current = fresh;
      const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setSpinning((current) =>
        current
          .filter((category) => fresh.winners[category])
          .concat(animate ? newly : []),
      );
      setStatus(fresh);
    }, pollMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pollMs]);

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
            <ResultCard
              key={category}
              category={category}
              winners={status.winners[category]}
              spinning={spinning.includes(category)}
              onSpun={() => setSpinning((current) => current.filter((c) => c !== category))}
            />
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

function ResultCard({
  category,
  winners,
  spinning,
  onSpun,
}: {
  category: Category;
  winners: Act[] | null;
  spinning: boolean;
  onSpun: () => void;
}) {
  const label = CROWD_CHOICE[category].label;
  const acts = CROWD_CHOICE[category].acts;
  const revealed = winners !== null;
  const [lit, setLit] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);
  const finish = useEffectEvent(onSpun);
  // A string, not the array: every poll returns a fresh array, and a new one
  // must not restart a roulette already spinning.
  const landingKey = winners?.[0]?.key ?? null;

  // The roulette. The result is already in `winners` when this starts, so the
  // hops are theatre: they slow down and stop on the act that really won (the
  // first of them, in a tie).
  useEffect(() => {
    if (!spinning || !landingKey) return;
    const target = acts.findIndex((act) => act.key === landingKey);
    if (target < 0) {
      finish();
      return;
    }
    // The last hop must light the winner: hop k lights act (k - 1) % length.
    let hops = MIN_HOPS;
    while ((hops - 1) % acts.length !== target) hops++;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = LEAD_MS;
    let gap = FIRST_HOP_MS;
    for (let hop = 1; hop <= hops; hop++) {
      const index = (hop - 1) % acts.length;
      timers.push(setTimeout(() => setLit(index), at));
      at += gap;
      if (hop > FAST_HOPS) gap *= SLOWDOWN;
    }
    timers.push(setTimeout(() => setLanded(true), at));
    timers.push(
      setTimeout(() => {
        setLit(null);
        setLanded(false);
        finish();
      }, at + LAND_MS),
    );
    return () => {
      timers.forEach(clearTimeout);
      setLit(null);
      setLanded(false);
    };
  }, [spinning, landingKey, acts]);

  const won = (act: Act) => winners?.some((w) => w.key === act.key) ?? false;
  const roulette = spinning && revealed;

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

      {roulette ? (
        <>
          <ul className="mt-[2cqw] flex gap-[0.8cqw]">
            {acts.map((act, index) => (
              <li
                key={act.key}
                className={`flex w-[7.4cqw] flex-col items-center rounded-[1cqw] border p-[0.6cqw] transition-all duration-100 ${
                  landed && won(act)
                    ? "-translate-y-[0.8cqw] scale-110 border-accent-2 bg-accent-2/25"
                    : landed
                      ? "border-ground/10 opacity-20"
                      : lit === index
                        ? "-translate-y-[0.5cqw] border-accent-4 bg-accent-4/25"
                        : "border-ground/15 opacity-45"
                }`}
                style={
                  landed && won(act)
                    ? { boxShadow: "0 0 3cqw var(--color-accent-2)" }
                    : lit === index && !landed
                      ? { boxShadow: PINK_GLOW }
                      : undefined
                }
              >
                <RouletteAvatar act={act} />
              </li>
            ))}
          </ul>
          <p className="mt-[1.6cqw] min-h-[3.4cqw] font-display text-[3cqw] uppercase leading-none text-white">
            {lit !== null ? acts[lit].name : ""}
          </p>
          <p className="mt-[0.6cqw] text-[1.9cqw] text-ground/60">
            {landed ? "" : "Drum roll…"}
          </p>
        </>
      ) : !revealed ? (
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

/** A small round face for the roulette: the act's photo, else its initials. */
function RouletteAvatar({ act }: { act: Act }) {
  if (act.photo) {
    return (
      <Image
        src={act.photo}
        alt=""
        width={96}
        height={96}
        className="aspect-square w-full rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid aspect-square w-full place-items-center rounded-full bg-gradient-to-br from-accent to-accent-4 font-display text-[2.4cqw] text-white"
    >
      {actInitials(act.name)}
    </span>
  );
}
