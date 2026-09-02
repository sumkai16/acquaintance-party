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
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-5 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Find a registration</h1>
        <p className="text-slate-500">
          Search by name or email when a student has lost their ticket link.
        </p>
      </header>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Name or email"
          aria-label="Search by name or email"
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Search
        </button>
      </form>

      {q.trim().length >= 2 && results.length === 0 ? (
        <p className="text-slate-500">
          Nothing matches “{q}”. Try just the surname, or the email they paid
          with.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {results.map((registration) => (
          <li
            key={registration.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4"
          >
            <div>
              <p className="font-semibold">{registration.full_name}</p>
              <p className="text-sm text-slate-500">
                {registration.year_level} · Section {registration.section} ·{" "}
                {registration.email}
              </p>
              <p className="text-sm text-slate-400">
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
                className="text-sm font-semibold text-slate-700 underline"
              >
                Open ticket
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
