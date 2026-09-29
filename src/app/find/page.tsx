import Link from "next/link";
import { EVENT } from "@/lib/config/event";
import { FindForm } from "./find-form";

/**
 * The questions staff kept getting in person. Each answer points back at
 * something on this page, so a student can fix it without waiting on
 * anyone. Don't promise manual code entry at the door — the scanner has none.
 */
const FAQ = [
  {
    q: "I paid but I don't have a QR yet.",
    a:
      "Every payment is checked by hand, so it can take a while. Look yourself up " +
      "above: your ticket page shows where it's at and updates on its own once " +
      "it's approved.",
  },
  {
    q: "I never got the email.",
    a:
      "Check Spam and Promotions first. You don't need the email to get in: look " +
      "yourself up above and your QR is on your ticket page.",
  },
  {
    q: "I only paid part of it.",
    a: "Your ticket page shows the balance. Pay the rest to an organiser.",
  },
  {
    q: "The email I registered with is wrong.",
    a: "Open \"Still stuck? Report a QR problem\" above and pick \"My email on file is wrong\".",
  },
  {
    q: "What do I show at the door?",
    a:
      "Your ticket page or a screenshot of the QR. Turn your screen brightness up " +
      "so it scans on the first try.",
  },
];

export const metadata = { title: `Find your ticket · ${EVENT.name}` };

export default function FindPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <Link
        href="/"
        className="inline-block py-3 text-sm font-semibold uppercase tracking-wide text-ink/70 hover:text-ink"
      >
        ← {EVENT.name}
      </Link>

      <h1 className="mt-4 font-display text-4xl uppercase md:text-5xl">
        Find your ticket
      </h1>
      <p className="mt-3 max-w-prose text-ink/75">
        Enter the student ID and email you registered with, and we&apos;ll take
        you straight to your ticket — no email required.
      </p>

      <div className="mt-8">
        <FindForm />
      </div>

      <section className="mt-10" aria-labelledby="common-problems">
        <h2
          id="common-problems"
          className="text-sm font-semibold uppercase tracking-wide text-ink/70"
        >
          Common problems
        </h2>
        <div className="mt-3 divide-y divide-ink/15 border-y border-ink/15">
          {FAQ.map((item) => (
            <details key={item.q} className="py-3">
              <summary className="cursor-pointer font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-accent">
                {item.q}
              </summary>
              <p className="mt-2 text-ink/75">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
