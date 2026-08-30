import Link from "next/link";
import { EVENT, formatPeso, formatTimeRange } from "@/lib/config/event";

// Deliberately plain. The designed landing page is the last build step, so
// that polish never blocks checkout, review, or the door scanner.
export default function HomePage() {
  const date = EVENT.startsAt.toLocaleDateString("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = formatTimeRange(EVENT.startsAt, EVENT.endsAt);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-7 px-5 py-20">
      <p className="text-sm uppercase tracking-[0.2em] text-ink/60">
        {EVENT.host} presents
      </p>

      <h1 className="font-display text-6xl uppercase leading-[0.85] md:text-8xl">
        {EVENT.name}
      </h1>

      <p className="text-lg text-ink/75">{EVENT.tagline}</p>

      <dl className="flex flex-wrap gap-x-10 gap-y-3 border-y border-ink/20 py-5">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/55">When</dt>
          <dd className="font-semibold">
            {date}, {time}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink/55">Where</dt>
          <dd className="font-semibold">{EVENT.venue}</dd>
        </div>
      </dl>

      <Link
        href="/checkout"
        className="self-start rounded bg-accent px-7 py-4 font-semibold uppercase tracking-wide text-ground transition-opacity hover:opacity-90"
      >
        Get your ticket — {formatPeso(EVENT.ticketPriceCentavos)}
      </Link>
    </main>
  );
}
