import Link from "next/link";
import { Badge } from "../badge";
import { formatPeso } from "@/lib/config/event";
import { searchRegistrations } from "@/lib/registrations/queries";
import { formatTicketCode } from "@/lib/tickets/code";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find a registration" };

const STATUS_TONE = { approved: "green", pending: "amber", rejected: "red" } as const;

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = await searchRegistrations(q);

  return (
    // A single-focus search screen, not a data-dense one — the gradient
    // hero treatment from the mockups, matching Scanner setup's same
    // single-task framing.
    <div className="min-h-[calc(100vh-49px)] bg-gradient-to-br from-deep via-deep to-accent/30">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-16">
        <header className="text-center">
          <h1 className="font-display text-4xl uppercase">Find a registration</h1>
          <p className="mt-2 text-ground/70">
            Search by name or email when a student has lost their ticket link.
          </p>
        </header>

        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Name or email"
            aria-label="Search by name or email"
            className="flex-1 rounded-md border border-ground/20 bg-black/20 px-3 py-2.5 text-sm text-ground outline-none placeholder:text-ground/40 focus:border-accent-2 focus:ring-2 focus:ring-accent-2/30"
          />
          <button
            type="submit"
            className="rounded-md bg-accent-2 px-5 py-2.5 text-sm font-semibold text-deep hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
          >
            Search
          </button>
        </form>

        {q.trim().length >= 2 && results.length === 0 ? (
          <p className="text-center text-ground/60">
            Nothing matches “{q}”. Try just the surname, or the email they paid
            with.
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {results.map((registration) => (
            <li
              key={registration.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ground/10 bg-black/20 p-4"
            >
              <div>
                <p className="font-semibold">{registration.full_name}</p>
                <p className="text-sm text-ground/60">
                  {registration.year_level} · Section {registration.section} ·{" "}
                  {registration.email}
                </p>
                <p className="text-sm text-ground/45">
                  {formatPeso(registration.amount)} · ref{" "}
                  <span className="font-mono">{registration.gcash_reference}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Badge tone={STATUS_TONE[registration.status]}>
                  {registration.status}
                </Badge>
                {registration.ticket_code ? (
                  <span className="font-mono text-sm">
                    {formatTicketCode(registration.ticket_code)}
                  </span>
                ) : null}
                <Link
                  href={`/ticket/${registration.id}`}
                  className="text-sm font-semibold text-accent-2 underline focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
                >
                  Open ticket
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
