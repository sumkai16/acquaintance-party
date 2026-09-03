import { searchRegistrations } from "@/lib/registrations/queries";
import { RegistrationRow } from "./registration-row";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find a registration" };

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
          <h1 className="font-display text-4xl uppercase">Find anyone&apos;s ticket</h1>
          <p className="mt-2 text-ground/70">
            Search by name or email when a student has lost their ticket link.
          </p>
        </header>

        <form className="flex flex-col items-center gap-6">
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

        {q.trim().length >= 2 && results.length === 0 ? (
          <p className="text-center text-ground/60">
            Nothing matches “{q}”. Try just the surname, or the email they paid
            with.
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {results.map((registration) => (
            <RegistrationRow key={registration.id} registration={registration} />
          ))}
        </ul>
      </main>
    </div>
  );
}
