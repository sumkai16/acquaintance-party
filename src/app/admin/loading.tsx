/**
 * Shown the instant an admin link is clicked, for every route under /admin
 * that doesn't ship its own loading file.
 *
 * Without this, App Router has nothing to paint while the server renders, so
 * it holds the *previous* page on screen — frozen, unclickable, no feedback —
 * until the new one is fully ready. That dead gap was the "lag": the work was
 * always this slow, it just had nowhere to show.
 *
 * Deliberately generic, because it stands in for pages of different shapes
 * (a table on Dashboard, cards on Cash, a log on Activity). Getting the
 * heading and the first block roughly right is enough to make the transition
 * read as "loading" rather than "broken". Neutral greys only — admin screens
 * are function-first, no theme accent (context/DESIGN.md).
 */
export default function AdminLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl p-6 2xl:max-w-7xl">
      <span className="sr-only" role="status">
        Loading
      </span>

      <div aria-hidden className="animate-pulse">
        <div className="h-8 w-56 rounded bg-ground/10" />

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="rounded-lg border border-ground/10 bg-ground/5 p-4"
            >
              <div className="h-4 w-20 rounded bg-ground/10" />
              <div className="mt-3 h-8 w-16 rounded bg-ground/10" />
            </div>
          ))}
        </div>

        <div className="mt-8 overflow-hidden rounded-lg border border-ground/10 bg-black/20">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-ground/5 px-4 py-3 last:border-b-0"
            >
              <div className="h-4 flex-1 rounded bg-ground/10" />
              <div className="h-4 w-24 rounded bg-ground/10" />
              <div className="h-4 w-16 rounded bg-ground/10" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
