import Link from "next/link";
import { listAdminEmails, searchRegistrations } from "@/lib/registrations/queries";
import { RegistrationRow } from "./registration-row";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find a registration" };

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status: rawStatus } = await searchParams;
  const status = STATUS_FILTERS.some((s) => s.value === rawStatus)
    ? (rawStatus as (typeof STATUS_FILTERS)[number]["value"])
    : undefined;

  const results = await searchRegistrations(q, status);
  // Only needed to label a rejected row with who rejected it — skip the
  // lookup entirely on an empty results page.
  const adminEmails = results.length > 0 ? await listAdminEmails() : new Map<string, string>();

  return (
    // A single-focus search screen, not a data-dense one — the gradient
    // hero treatment from the mockups, matching Scanner setup's same
    // single-task framing. Browsing by status (below) reuses the same
    // narrow card layout rather than switching to a dense table.
    <div className="min-h-[calc(100vh-49px)] bg-gradient-to-br from-deep via-deep to-accent/30">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-16">
        <header className="text-center">
          <h1 className="font-display text-4xl uppercase">Find anyone&apos;s ticket</h1>
          <p className="mt-2 text-ground/70">
            Search by name or email, or browse by status below.
          </p>
        </header>

        <form className="flex flex-col items-center gap-6">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Type a name or email…"
            aria-label="Search by name or email"
            className="w-full border-0 border-b-2 border-accent bg-transparent px-1 py-3 text-center text-xl text-ground outline-none placeholder:text-ground/40 focus:border-accent-2 focus:outline-2 focus:outline-offset-4 focus:outline-accent-2"
          />
          <button
            type="submit"
            className="rounded-full bg-accent px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white hover:opacity-90 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {STATUS_FILTERS.map((filter) => {
            const active = status === filter.value;
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            params.set("status", filter.value);
            return (
              <Link
                key={filter.value}
                href={`?${params.toString()}`}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 ${
                  active
                    ? "bg-accent text-white"
                    : "bg-ground/10 text-ground/70 hover:bg-ground/20 hover:text-ground"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        {q.trim().length < 2 && status && results.length > 0 ? (
          <p className="text-center text-ground/60">
            {results.length} registration{results.length === 1 ? "" : "s"}
            {status === "all" ? "" : ` (${status})`}, most recent first.
          </p>
        ) : null}

        {q.trim().length >= 2 && results.length === 0 ? (
          <p className="text-center text-ground/60">
            Nothing matches “{q}”. Try just the surname, or the email they paid
            with.
          </p>
        ) : null}

        {q.trim().length < 2 && status && results.length === 0 ? (
          <p className="text-center text-ground/60">
            {status === "all" ? "Nothing here yet." : `Nothing ${status} yet.`}
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {results.map((registration) => (
            <RegistrationRow
              key={registration.id}
              registration={registration}
              reviewerEmail={
                registration.reviewed_by
                  ? (adminEmails.get(registration.reviewed_by) ?? null)
                  : null
              }
            />
          ))}
        </ul>
      </main>
    </div>
  );
}
