import Link from "next/link";
import { EVENT, formatPeso, formatTimeRange } from "@/lib/config/event";

// The hero stays structurally theme-neutral — eyebrow, title, date, call to
// action — so swapping the party theme is a token edit, not a rebuild.
export default function HomePage() {
  const date = EVENT.startsAt.toLocaleDateString("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = formatTimeRange(EVENT.startsAt, EVENT.endsAt);
  const price = formatPeso(EVENT.ticketPriceCentavos);

  return (
    <main className="flex-1">
      <section className="bg-deep text-ground">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-7 px-5 py-14 sm:py-20 md:py-28 2xl:max-w-7xl">
          <p className="text-sm uppercase tracking-[0.2em] text-ground/70">
            {EVENT.host} presents
          </p>

          {/* leading stays tight for the poster look, but not so tight that
              the lines collide once the name wraps on a phone. */}
          <h1 className="font-display text-5xl uppercase leading-[0.95] text-accent-2 sm:text-6xl md:text-8xl md:leading-[0.9]">
            {EVENT.name}
          </h1>

          <p className="max-w-prose text-lg text-ground/85">{EVENT.tagline}</p>

          <dl className="flex flex-wrap gap-x-10 gap-y-3 border-y border-ground/25 py-5">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ground/65">
                When
              </dt>
              <dd className="font-semibold">
                {date}, {time}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-ground/65">
                Where
              </dt>
              <dd className="font-semibold">{EVENT.venue}</dd>
            </div>
          </dl>

          <Link
            href="/checkout"
            className="w-full shrink-0 rounded bg-accent px-8 py-4 text-center text-xl font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 sm:w-auto sm:self-start"
          >
            Get your ticket{" "}
            {/* Its own element so a narrow phone drops the price onto a
                second line cleanly, instead of stranding a dash. */}
            <span className="whitespace-nowrap font-normal">{price}</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 py-16 2xl:max-w-7xl">
        <p className="text-sm uppercase tracking-[0.2em] text-ink/70">
          What you get
        </p>
        <h2 className="mt-2 font-display text-4xl uppercase md:text-5xl">
          Your ticket includes
        </h2>

        <ul className="mt-8 grid gap-5 md:grid-cols-3">
          {EVENT.inclusions.map((item) => (
            <li
              key={item.title}
              className="rounded border border-ink/20 bg-white/60 p-5"
            >
              <h3 className="font-display text-2xl uppercase">{item.title}</h3>
              <p className="mt-2 text-ink/75">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-accent-3/15">
        <div className="mx-auto w-full max-w-5xl px-5 py-16 2xl:max-w-7xl">
          <p className="text-sm uppercase tracking-[0.2em] text-ink/70">
            How it works
          </p>
          <h2 className="mt-2 font-display text-4xl uppercase md:text-5xl">
            Three steps
          </h2>

          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            <li>
              <p className="font-display text-5xl text-accent">01</p>
              <h3 className="mt-2 font-display text-2xl uppercase">
                Pay with GCash
              </h3>
              <p className="mt-2 text-ink/75">
                Send {price} to the account shown at checkout, then keep the
                receipt open — you will need its reference number.
              </p>
            </li>
            <li>
              <p className="font-display text-5xl text-accent">02</p>
              <h3 className="mt-2 font-display text-2xl uppercase">
                Upload your receipt
              </h3>
              <p className="mt-2 text-ink/75">
                Fill in your details, attach the receipt screenshot, and type
                the reference number. An organiser checks it by hand.
              </p>
            </li>
            <li>
              <p className="font-display text-5xl text-accent">03</p>
              <h3 className="mt-2 font-display text-2xl uppercase">
                Get your QR
              </h3>
              <p className="mt-2 text-ink/75">
                You land on a permanent ticket link. Once it is approved, it
                shows the QR code that gets you through the door.
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 py-16 2xl:max-w-7xl">
        <h2 className="font-display text-4xl uppercase md:text-5xl">
          Questions
        </h2>

        <div className="mt-8 max-w-3xl divide-y divide-ink/15 border-y border-ink/15">
          {EVENT.faq.map((item) => (
            <details key={item.question} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-accent [&::-webkit-details-marker]:hidden">
                {item.question}
                <span
                  aria-hidden
                  className="shrink-0 text-2xl leading-none text-accent transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-prose text-ink/75">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-deep text-ground">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between 2xl:max-w-7xl">
          <div>
            <h2 className="font-display text-4xl uppercase text-accent-2 md:text-5xl">
              See you there
            </h2>
            <p className="mt-2 text-ground/80">
              {date}, {time} · {EVENT.venue}
            </p>
          </div>

          <Link
            href="/checkout"
            className="w-full shrink-0 rounded bg-accent px-8 py-4 text-center text-xl font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 sm:w-auto sm:self-start md:self-auto"
          >
            Get your ticket{" "}
            {/* Its own element so a narrow phone drops the price onto a
                second line cleanly, instead of stranding a dash. */}
            <span className="whitespace-nowrap font-normal">{price}</span>
          </Link>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-5xl px-5 py-8 text-sm text-ink/70 2xl:max-w-7xl">
        <p>Something wrong with your ticket? {EVENT.contact}</p>
      </footer>
    </main>
  );
}
