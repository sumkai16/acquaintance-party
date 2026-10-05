import { evaluationSummary, pendingInviteRecipients } from "@/lib/evaluation/queries";
import Link from "next/link";
import { Results } from "./results";
import { SendInvites } from "./send-invites";

export const dynamic = "force-dynamic";
// The AI summary button runs as a server action on this page; a busy free
// model can take a while.
export const maxDuration = 60;
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
 * Who answered, as a grid: year levels down the side, sections across the top,
 * each cell shaded by its count. The two flat lists it replaces were as tall as
 * the number of year-and-section pairs; this is as tall as the year levels.
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
  const cell = new Map<string, number>();
  const columns = new Set<string>();
  for (const row of sections) {
    const [year, section] = row.option.split(" · ");
    if (!year || !section) continue;
    cell.set(`${year}|${section}`, row.count);
    columns.add(section);
  }
  const letters = [...columns].sort();
  // "1st year", "2nd year"… in order, not busiest-first like the other lists.
  const rows = [...years].sort(
    (a, b) => parseInt(a.option, 10) - parseInt(b.option, 10),
  );
  const busiest = Math.max(1, ...cell.values());

  return (
    <section className="rounded-lg border border-ground/10 bg-ground/5 p-4">
      <h2 className="font-semibold">
        Who responded{" "}
        <span className="text-sm font-normal text-ground/50">
          {total} responses
        </span>
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-sm tabular-nums">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-ground/60">
              <th scope="col" className="px-2 py-1 text-left font-medium">
                Year
              </th>
              {letters.map((letter) => (
                <th key={letter} scope="col" className="px-2 py-1 font-medium">
                  {letter}
                </th>
              ))}
              <th scope="col" className="px-2 py-1 font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((year) => (
              <tr key={year.option}>
                <th scope="row" className="px-2 py-2 text-left font-medium">
                  {year.option}
                </th>
                {letters.map((letter) => {
                  const count = cell.get(`${year.option}|${letter}`);
                  return count ? (
                    <td key={letter} className="relative rounded px-2 py-2 text-center">
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded bg-accent"
                        style={{ opacity: 0.18 + (0.82 * count) / busiest }}
                      />
                      <span className="relative font-semibold text-white">
                        {count}
                      </span>
                    </td>
                  ) : (
                    <td
                      key={letter}
                      className="rounded bg-ground/5 px-2 py-2 text-center text-ground/25"
                    >
                      ·
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center font-bold text-accent-2">
                  {year.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
