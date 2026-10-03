import { EVENT } from "@/lib/config/event";
import { LookupForm } from "./lookup-form";

export const metadata = { title: `Evaluate the party · ${EVENT.name}` };

/**
 * Where the shared evaluation QR on the projector lands. A student says who
 * they are (name + the email they registered with) and is sent on to their own
 * /evaluate/<id>, the same page the emailed invite links to. Public and
 * unauthenticated; see actions.ts for how they are identified.
 */
export default function EvaluateLookupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-5 py-12">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-ink/60">{EVENT.host}</p>
        <h1 className="mt-2 font-display text-4xl uppercase text-accent sm:text-5xl">
          How was it?
        </h1>
        <p className="mt-3 text-ink/70">
          Tell the Information Tech Society how {EVENT.name} went. Enter your name and
          the email you registered with and we&apos;ll open your evaluation. Your
          certificate of attendance is ready as soon as you send it.
        </p>
      </header>

      <LookupForm />

      <p className="text-sm text-ink/60">
        Only people scanned in at the door can evaluate. Not finding yourself? Tell an
        organiser. {EVENT.contact}
      </p>
    </main>
  );
}
