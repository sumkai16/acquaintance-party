import { evaluationSummary, pendingInviteRecipients } from "@/lib/evaluation/queries";
import Link from "next/link";
import { Bar } from "./bar";
import { Results } from "./results";
import { SendInvites } from "./send-invites";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evaluation" };

export default async function EvaluationsPage() {
  const [summary, pending] = await Promise.all([
    evaluationSummary(),
    pendingInviteRecipients(),
  ]);

  const rate =
    summary.checkedIn === 0
      ? "—"
      : `${Math.round((summary.responses / summary.checkedIn) * 100)}%`;

  return (
    <main className="mx-auto w-full max-w-5xl p-6 2xl:max-w-7xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Evaluation</h1>
        <p className="text-ground/60">
          Totals only — no names, including on the written answers.
        </p>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Checked in" value={summary.checkedIn} />
        <Stat label="Emailed" value={summary.invited} />
        <Stat label="Responses" value={summary.responses} />
        <Stat label="Response rate" value={rate} />
      </dl>

      <section className="mt-8 rounded-lg border border-ground/10 bg-ground/5 p-4">
        <h2 className="text-lg font-semibold">Invites</h2>
        <p className="mt-1 mb-3 text-sm text-ground/70">
          Emails everyone scanned in at the door who hasn&apos;t had the link
          yet. Safe to press again — it never emails the same person twice, and
          it picks up scans that synced late.
        </p>
        <SendInvites pending={pending.length} />
      </section>

      <section className="mt-4 rounded-lg border border-ground/10 bg-ground/5 p-4">
        <h2 className="text-lg font-semibold">Evaluation QR</h2>
        <p className="mt-1 mb-3 text-sm text-ground/70">
          One QR for everyone, to put on the projector. Students enter their name and the
          email they registered with, and land on their own evaluation. Only people
          scanned in at the door can open one.
        </p>
        <Link
          href="/admin/evaluations/qr"
          className="inline-block rounded-full bg-accent-2 px-5 py-2.5 text-sm font-semibold text-deep hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          Show QR full screen
        </Link>
      </section>

      {summary.responses === 0 ? (
        <p className="mt-8 rounded-lg border border-ground/10 bg-ground/5 p-4 text-ground/60">
          No responses yet. They appear here as students send them.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          <section className="grid gap-4 md:grid-cols-2">
            <Tally
              title="Responses by year level"
              rows={summary.byYearLevel}
              total={summary.responses}
            />
            <Tally
              title="Responses by section"
              rows={summary.bySection}
              total={summary.responses}
            />
          </section>
          <Results sections={summary.sections} responses={summary.responses} />
        </div>
      )}
    </main>
  );
}

function Tally({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { option: string; count: number }[];
  total: number;
}) {
  return (
    <div className="rounded-lg border border-ground/10 bg-ground/5 p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 flex flex-col gap-1.5">
        {rows.map((row) => (
          <Bar key={row.option} label={row.option} count={row.count} total={total} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-ground/10 bg-ground/5 p-4">
      <dt className="text-sm text-ground/60">{label}</dt>
      <dd className="text-3xl font-bold tabular-nums text-ground">{value}</dd>
    </div>
  );
}
