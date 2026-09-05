import Image from "next/image";
import Link from "next/link";
import { EVENT, formatPeso, formatTimeRange } from "@/lib/config/event";

// One icon accent per inclusion, matched by position to the confirmed
// design (circle / circle / diamond) — not tied to inclusion content, so
// reordering EVENT.inclusions still gets a sensible icon.
const INCLUSION_ICONS = [
  <span key="circle-1" aria-hidden className="size-9 shrink-0 rounded-full bg-accent-2" />,
  <span key="circle-2" aria-hidden className="size-9 shrink-0 rounded-full bg-accent" />,
  <span key="diamond" aria-hidden className="m-1 size-7 shrink-0 rotate-45 rounded bg-deep" />,
];

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
      {/* The whole hero — photo + info panel + CTA — fills exactly one
          screen (dvh, not vh, so mobile browser chrome collapsing doesn't
          leave a gap at the fold) so the ticket CTA needs zero scrolling to
          reach. The photo takes whatever height that leaves over. */}
      <section className="flex min-h-dvh flex-col">
        {/* Immersive photo hero — the image carries the mood, the gradient
            fade keeps the headline readable regardless of what's behind it
            at that exact pixel. */}
        <div className="relative min-h-[240px] flex-1 overflow-hidden">
          <Image
            src="/landing-hero.jpg"
            alt=""
            fill
            priority
            className="object-cover"
            style={{ objectPosition: "center 30%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-deep/0 via-deep/70 to-deep" />

          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-5xl px-5 pb-8 sm:px-8 sm:pb-10 2xl:max-w-7xl">
            <p className="text-sm uppercase tracking-[0.2em] text-ground/80">
              {EVENT.host} presents
            </p>

            {/* leading stays tight for the poster look, but not so tight that
                the lines collide once the name wraps on a phone. The
                pink-to-gold gradient fill is the confirmed mockup's
                signature touch — built from the same accent-4/accent-2
                tokens used everywhere else, not new hex. */}
            <h1 className="mt-2 bg-gradient-to-r from-accent-4 via-accent-2 to-accent-4 bg-clip-text font-display text-5xl uppercase leading-[0.95] text-transparent sm:text-6xl md:text-8xl md:leading-[0.9]">
              {EVENT.name}
            </h1>

            <p className="mt-2 text-lg text-ground/90">{EVENT.tagline}</p>
          </div>
        </div>

        <div className="shrink-0 bg-deep text-ground">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8 sm:px-8 2xl:max-w-7xl">
            <dl className="flex flex-wrap gap-x-10 gap-y-3 border-b border-ground/25 pb-6">
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
              className="w-full rounded bg-accent px-8 py-4 text-center text-xl font-semibold uppercase tracking-wide text-white transition-opacity hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              Get your ticket{" "}
              {/* Its own element so a narrow phone drops the price onto a
                  second line cleanly, instead of stranding a dash. */}
              <span className="whitespace-nowrap font-normal">{price}</span>
            </Link>
          </div>
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
          {EVENT.inclusions.map((item, index) => (
            <li
              key={item.title}
              className="flex gap-4 rounded border border-ink/20 bg-white/60 p-5"
            >
              {INCLUSION_ICONS[index]}
              <div>
                <h3 className="font-display text-2xl uppercase">
                  {item.title}
                </h3>
                <p className="mt-2 text-ink/75">{item.body}</p>
              </div>
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
