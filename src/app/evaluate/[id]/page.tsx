import { notFound, redirect } from "next/navigation";
import { EVENT } from "@/lib/config/event";
import { evaluationContext } from "@/lib/evaluation/queries";
import { EvaluationForm } from "./evaluation-form";

export const dynamic = "force-dynamic";
export const metadata = { title: `Evaluate the party · ${EVENT.name}` };

export default async function EvaluatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await evaluationContext(id);
  if (!context) notFound();

  // Already answered — nothing to do here but hand over the certificate.
  if (context.evaluation) redirect(`/certificate/${id}`);

  if (!context.checkedInAt) return <NotCheckedIn />;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-5 py-12">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-ink/60">
          {EVENT.host}
        </p>
        <h1 className="mt-2 font-display text-4xl uppercase text-accent sm:text-5xl">
          How was it?
        </h1>
        <p className="mt-3 text-ink/70">
          Hi {context.registration.full_name.split(" ")[0]} — a few quick
          questions about {EVENT.name}. Send it and your certificate of
          attendance is ready straight away.
        </p>
      </header>

      <EvaluationForm registrationId={id} />
    </main>
  );
}

/**
 * Approved, but never scanned at the door. The certificate says they attended,
 * so this is the one thing we can't wave through — but it's also the case
 * where a scanner failed on the night, so it points at a human.
 */
function NotCheckedIn() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-5 py-12 text-center">
      <h1 className="font-display text-3xl uppercase text-ink/70">
        No check-in on record
      </h1>
      <p className="text-ink/70">
        This evaluation is for students who were scanned in at the door, and we
        have no scan against your ticket.
      </p>
      <p className="text-ink/70">
        If you were there and the scanner gave you trouble, tell an organiser
        and they can sort it out. {EVENT.contact}
      </p>
    </main>
  );
}
