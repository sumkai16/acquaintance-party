"use client";

import { useState, useTransition } from "react";
import type { QuestionSummary, SectionSummary } from "@/lib/evaluation/queries";
import { RATING_LABELS, RATING_SCALE } from "@/lib/evaluation/questions";
import type { AiSummary } from "@/lib/evaluation/theme-tally";
import { analyzeText } from "@/lib/evaluation/text-analysis";
import { summarizeQuestion } from "./actions";
import { Bar } from "./bar";

/**
 * The results, one section at a time. The summary is long enough (nine
 * sections, ~50 ratings, ~17 written questions) that showing all of it was a
 * scroll of several screens; a section list on the left keeps the page the
 * height of a single section instead.
 */
export function Results({
  sections,
  responses,
}: {
  sections: SectionSummary[];
  responses: number;
}) {
  const [selected, setSelected] = useState(sections[0]?.id);
  const section = sections.find((item) => item.id === selected) ?? sections[0];
  if (!section) return null;

  const ratings = section.questions.filter((q) => q.kind === "rating");
  const choices = section.questions.filter(
    (q) => q.kind === "choice" || q.kind === "multi",
  );
  const written = section.questions.filter((q) => q.kind === "text");

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_1fr] lg:items-start">
      <nav
        aria-label="Evaluation sections"
        className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-4 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
      >
        {sections.map((item) => {
          const active = item.id === section.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "true" : undefined}
              onClick={() => setSelected(item.id)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 lg:shrink ${
                active
                  ? "border-ground/20 bg-ground/10"
                  : "border-transparent hover:bg-ground/5"
              }`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span>{item.title}</span>
                {item.average !== null ? (
                  <span className="font-display text-base text-accent-2 tabular-nums">
                    {item.average.toFixed(1)}
                  </span>
                ) : null}
              </span>
              {item.average !== null ? (
                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-ground/10">
                  <span
                    className="block h-full bg-accent"
                    style={{ width: `${(item.average / 5) * 100}%` }}
                  />
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
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

        {ratings.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {ratings.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                responses={responses}
              />
            ))}
          </div>
        ) : null}

        {choices.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            responses={responses}
          />
        ))}

        {written.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            responses={responses}
          />
        ))}
      </div>
    </div>
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
        ) : question.kind === "text" ? (
          <span className="text-sm text-ground/50">
            {question.responses.length} answers
          </span>
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
        <WrittenAnswers id={question.id} answers={question.responses} />
      )}
    </section>
  );
}

/** A fixed-height, searchable list, so a long run of answers never grows the page. */
function WrittenAnswers({ id, answers }: { id: string; answers: string[] }) {
  const [search, setSearch] = useState("");

  if (answers.length === 0) {
    return <p className="mt-3 text-sm text-ground/50">Nobody answered this one.</p>;
  }

  const needle = search.trim().toLowerCase();
  const shown = needle
    ? answers.filter((answer) => answer.toLowerCase().includes(needle))
    : answers;
  const stats = analyzeText(answers);

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-sm text-ground/80">
        <span className="font-semibold text-ground">
          {Math.round((stats.noAnswer / stats.total) * 100)}%
        </span>{" "}
        gave no answer ({stats.noAnswer} of {stats.total}).
        {stats.topTerms.length > 0 ? (
          <>
            {" "}
            Most mentioned:{" "}
            {stats.topTerms.map((item, index) => (
              <span key={item.term}>
                {index > 0 ? ", " : ""}
                <span className="font-semibold text-ground">{item.term}</span>{" "}
                <span className="tabular-nums text-ground/60">{item.count}</span>
              </span>
            ))}
            .
          </>
        ) : null}
      </p>
      <AiReading questionId={id} />
      {answers.length > 8 ? (
        <input
          id={`search-${id}`}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search answers"
          aria-label="Search answers"
          className="rounded-lg border border-ground/10 bg-black/20 px-3 py-1.5 text-sm text-ground placeholder:text-ground/40 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        />
      ) : null}
      {/* tabIndex so keyboard users can scroll the box. */}
      <ul
        tabIndex={0}
        aria-label="Written answers"
        className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      >
        {shown.length === 0 ? (
          <li className="text-sm text-ground/50">No answers match.</li>
        ) : (
          shown.map((answer, index) => (
            <li
              key={index}
              className="rounded border border-ground/10 bg-ground/5 px-3 py-2 text-sm text-ground/90"
            >
              {answer}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

const MOOD_LABEL: Record<AiSummary["mood"], string> = {
  positive: "Positive",
  mixed: "Mixed",
  negative: "Negative",
  neutral: "Neutral",
};

/** The AI summary for one question: a button, then the summary and its themes. */
function AiReading({ questionId }: { questionId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<
    { ok: true; summary: AiSummary } | { ok: false; error: string } | null
  >(null);

  function run() {
    start(async () => {
      setResult(await summarizeQuestion(questionId));
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="self-start rounded-full border border-accent-2/60 px-3.5 py-1.5 text-sm font-semibold text-accent-2 hover:bg-accent-2/10 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 disabled:opacity-60"
      >
        {pending ? "Reading the answers…" : result?.ok ? "Summarize again" : "Summarize with AI"}
      </button>

      {result && !result.ok ? (
        <p role="alert" className="text-sm text-accent-4">
          {result.error}
        </p>
      ) : null}

      {result?.ok ? (
        <div className="rounded-lg border border-accent-2/30 bg-black/20 p-3">
          <p className="text-sm text-ground/90">
            <span className="mr-2 rounded-full bg-ground/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
              {MOOD_LABEL[result.summary.mood]}
            </span>
            {result.summary.summary}
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {result.summary.themes.map((theme) => (
              <li key={theme.label}>
                <Bar
                  label={theme.label}
                  count={theme.count}
                  total={result.summary.answers}
                />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ground/50">
            Written by AI from these answers. Counts are exact; the wording is a summary.
          </p>
        </div>
      ) : null}
    </div>
  );
}
