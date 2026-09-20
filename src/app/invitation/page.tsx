import { cookies } from "next/headers";
import { EVENT } from "@/lib/config/event";
import { ENTERED_COOKIE } from "@/lib/faculty/cookie";
import { LETTER } from "@/lib/faculty/letter";
import { InvitationForm } from "./invitation-form";

export const metadata = {
  title: "Letter of Invitation",
  description: `An invitation to the ${EVENT.name}, for the faculty.`,
};

// Reads a cookie and has no cached form — a stale copy of this page would
// show the form to someone already entered, or hide it from someone who
// isn't.
export const dynamic = "force-dynamic";

/**
 * The faculty letter of invitation, opened by scanning the shared QR.
 *
 * Public and unauthenticated: there is no per-person link and no session, so
 * the page identifies nobody. Acknowledging it is the entry, and the write
 * goes through a server action on the service-role client — faculty_invitations
 * has no RLS policy for any role. See 0017_faculty_raffle.sql.
 *
 * Themed like the other public surfaces (context/DESIGN.md §3) but composed
 * as a document rather than a poster: a plain paper card holds the letter, so
 * it reads the way a letter of invitation should, and the theme lives in the
 * band above it and the accents around it.
 */
export default async function InvitationPage() {
  const enteredAs = (await cookies()).get(ENTERED_COOKIE)?.value ?? null;

  return (
    <main className="min-h-screen bg-ground text-ink">
      <header className="bg-deep px-6 py-10 text-ground">
        <div className="mx-auto max-w-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-ground/60">
            {EVENT.host}
          </p>
          <h1 className="mt-2 font-display text-4xl uppercase leading-none text-accent-2 sm:text-5xl">
            {EVENT.name}
          </h1>
          <p className="mt-2 text-ground/70">{EVENT.tagline}</p>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
        <article className="rounded-lg border border-ink/10 bg-white px-6 py-8 leading-relaxed shadow-sm sm:px-9 sm:py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
            {LETTER.title}
          </p>

          <p className="mt-6 font-semibold">{LETTER.salutation}</p>

          {LETTER.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="mt-4 text-ink/85">
              {paragraph}
            </p>
          ))}

          <dl className="mt-7 grid gap-x-4 gap-y-2 border-y border-ink/10 py-5 sm:grid-cols-[6rem_1fr]">
            {LETTER.details.map((detail) => (
              <div key={detail.label} className="contents">
                <dt className="text-sm font-semibold uppercase tracking-wide text-ink/50">
                  {detail.label}
                </dt>
                <dd className="mb-2 sm:mb-0">{detail.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-7">{LETTER.closing}</p>

          <ul className="mt-5 flex flex-col gap-3">
            {LETTER.signatories.map((signatory) => (
              <li key={signatory.name}>
                <span className="block font-semibold">{signatory.name}</span>
                <span className="block text-sm text-ink/60">{signatory.role}</span>
              </li>
            ))}
          </ul>
        </article>

        <section className="rounded-lg border border-ink/15 bg-ground px-6 py-7 sm:px-8">
          {enteredAs ? (
            <div role="status" className="flex flex-col gap-2">
              <h2 className="font-display text-2xl uppercase text-accent">
                You&apos;re on the list.
              </h2>
              <p className="text-ink/70">
                Entered as {enteredAs}. Nothing else to do — the giveaway is
                drawn during the programme.
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl uppercase text-accent">
                Confirm and enter
              </h2>
              <p className="mt-1 mb-6 text-ink/70">
                Tick the box, then give your name. That&apos;s your entry to the
                faculty giveaway.
              </p>
              <InvitationForm />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
