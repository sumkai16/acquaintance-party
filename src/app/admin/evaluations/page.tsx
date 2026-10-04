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
          <Respondents
            years={summary.byYearLevel}
            sections={summary.bySection}
            total={summary.responses}
          />
          <Results sections={summary.sections} responses={summary.responses} />
        </div>
      )}
    </main>
  );
}

/**
 * Who answered, in one card: a bar per year level, with that year's sections as
 * chips underneath. Two separate bar lists left a short card beside a
 * two-dozen-row one; this is as tall as the year levels, not the sections.
 * `sections` options are "<year level> · <section>" (built in evaluationSummary).
 */
function Respondents({
  years,
  sections,
  total,
}: {
  years: { option: string; count: number }[];
  sections: { option: string; count: number }[];
  total: number;
}) {
  return (
    <section className="rounded-lg border border-ground/10 bg-ground/5 p-4">
      <h2 className="font-semibold">Who responded</h2>
      <div className="mt-3 grid gap-x-8 gap-y-4 md:grid-cols-2">
        {years.map((year) => {
          const prefix = `${year.option} · `;
          const inYear = sections.filter((row) => row.option.startsWith(prefix));
          return (
            <div key={year.option} className="flex flex-col gap-2">
              <Bar label={year.option} count={year.count} total={total} />
              <ul className="flex flex-wrap gap-1.5">
                {inYear.map((row) => (
                  <li
                    key={row.option}
                    className="rounded-full border border-ground/10 bg-black/20 px-2.5 py-0.5 text-xs tabular-nums text-ground/80"
                  >
                    {row.option.slice(prefix.length)}{" "}
                    <span className="font-semibold text-ground">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
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
