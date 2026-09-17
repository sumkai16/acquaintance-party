import {
  evaluationSummary,
  pendingInviteRecipients,
  type QuestionSummary,
} from "@/lib/evaluation/queries";
import { RATING_LABELS, RATING_SCALE } from "@/lib/evaluation/questions";
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

      {summary.responses === 0 ? (
        <p className="mt-8 rounded-lg border border-ground/10 bg-ground/5 p-4 text-ground/60">
          No responses yet. They appear here as students send them.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {summary.sections.map((section) => (
            <section key={section.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ground/10 pb-2">
                <h2 className="text-xl font-semibold">{section.title}</h2>
                {section.average !== null ? (
                  <span className="text-sm text-ground/60">
                    Section average{" "}
                    <span className="text-lg font-bold tabular-nums text-ground">
                      {section.average.toFixed(1)}
                    </span>{" "}
                    / 5
                  </span>
                ) : null}
              </div>
              {section.questions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  responses={summary.responses}
                />
              ))}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function QuestionCard({
  question,
  responses,
}: {
  question: QuestionSummary;
  responses: number;
}) {
  return (
    <section className="rounded-lg border border-ground/10 bg-ground/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">{question.prompt}</h3>
        {question.kind === "rating" && question.average !== null ? (
          <span className="text-2xl font-bold tabular-nums">
            {question.average.toFixed(1)}
            <span className="text-sm font-normal text-ground/50"> / 5</span>
          </span>
        ) : question.kind === "multi" ? (
          <span className="text-sm text-ground/50">Tick all that apply</span>
        ) : null}
      </div>

      {question.kind === "rating" ? (
        <div className="mt-3 flex flex-col gap-1.5">
          {[...RATING_SCALE].reverse().map((point) => (
            <Bar
              key={point}
              label={`${point} · ${RATING_LABELS[point]}`}
              count={question.counts[point - 1]}
              total={responses}
            />
          ))}
          {question.notApplicable !== null ? (
            <Bar label="N/A" count={question.notApplicable} total={responses} />
          ) : null}
        </div>
      ) : question.kind !== "text" ? (
        <div className="mt-3 flex flex-col gap-1.5">
          {question.counts.map((row) => (
            <Bar
              key={row.option}
              label={row.option}
              count={row.count}
              total={responses}
            />
          ))}
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {question.responses.length === 0 ? (
            <li className="text-sm text-ground/50">Nobody answered this one.</li>
          ) : (
            question.responses.map((response, index) => (
              <li
                key={index}
                className="rounded border border-ground/10 bg-ground/5 px-3 py-2 text-sm text-ground/90"
              >
                {response}
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}

function Bar({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const share = total === 0 ? 0 : (count / total) * 100;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-44 shrink-0 truncate text-ground/70" title={label}>{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ground/10">
        <div className="h-full bg-accent" style={{ width: `${share}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right tabular-nums text-ground/70">
        {count}
      </span>
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
