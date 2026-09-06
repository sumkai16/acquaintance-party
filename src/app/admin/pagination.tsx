import Link from "next/link";

/**
 * Page-number pagination for a URL-driven list — same "state lives in the
 * URL" convention as every filter bar in /admin, so a specific page (and
 * its filters) survives a refresh or a shared link. `buildHref` gets just
 * the target page number and returns the full URL, so the caller decides
 * which other query params (filters, sort) ride along unchanged.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const linkClass =
    "rounded-md border border-ground/20 px-3 py-1.5 text-sm font-medium text-ground/80 hover:border-ground/40 hover:text-ground focus:outline-2 focus:outline-offset-2 focus:outline-accent-2";
  const disabledClass = "pointer-events-none opacity-40";

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ground/60">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Link
          href={buildHref(page - 1)}
          aria-disabled={page <= 1}
          tabIndex={page <= 1 ? -1 : undefined}
          className={`${linkClass} ${page <= 1 ? disabledClass : ""}`}
        >
          Previous
        </Link>
        <Link
          href={buildHref(page + 1)}
          aria-disabled={page >= totalPages}
          tabIndex={page >= totalPages ? -1 : undefined}
          className={`${linkClass} ${page >= totalPages ? disabledClass : ""}`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
