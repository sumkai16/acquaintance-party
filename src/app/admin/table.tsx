import Link from "next/link";

/**
 * The shared visual shell for every admin table (Attendance, Review Queue,
 * Find a registration) — same wrapper, same `<table>` base, same empty-state
 * slot. Lifted from what all three already looked like independently, not a
 * redesign.
 */
export function Table({
  children,
  empty,
}: {
  children: React.ReactNode;
  empty?: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ground/10 bg-black/20">
      <table className="w-full border-collapse text-sm">{children}</table>
      {empty ? <p className="px-4 py-6 text-ground/60">{empty}</p> : null}
    </div>
  );
}

/** A plain, non-sortable header cell. */
export function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`py-2 pr-3 text-ground/70 first:pl-4 last:pl-3 ${className}`}>
      {children}
    </th>
  );
}

function SortLabel({
  label,
  active,
  direction,
}: {
  label: string;
  active: boolean;
  direction: "asc" | "desc";
}) {
  return (
    <>
      {label}
      {active ? <span aria-hidden>{direction === "asc" ? "↑" : "↓"}</span> : null}
    </>
  );
}

const SORT_TRIGGER_CLASS =
  "inline-flex items-center gap-1 font-semibold text-ground/70 hover:text-ground focus:outline-2 focus:outline-offset-2 focus:outline-accent-2";

/**
 * A sortable header cell for a page whose sort state lives in the URL
 * (Attendance, Find a registration) — clicking navigates to `href`, which
 * the caller builds from its own searchParams.
 */
export function SortHeaderLink({
  label,
  href,
  active,
  direction,
  className = "",
}: {
  label: string;
  href: string;
  active: boolean;
  direction: "asc" | "desc";
  className?: string;
}) {
  const nextDir = active && direction === "asc" ? "desc" : "asc";
  return (
    <th className={`py-2 pr-3 first:pl-4 last:pl-3 ${className}`}>
      <Link
        href={href}
        aria-label={`Sort by ${label}, ${nextDir}ending`}
        className={SORT_TRIGGER_CLASS}
      >
        <SortLabel label={label} active={active} direction={direction} />
      </Link>
    </th>
  );
}

/**
 * A sortable header cell for a page that sorts client-side, in memory
 * (Review Queue — deliberately not URL-driven, see review-table.tsx).
 */
export function SortHeaderButton({
  label,
  onClick,
  active,
  direction,
  className = "",
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  direction: "asc" | "desc";
  className?: string;
}) {
  const nextDir = active && direction === "asc" ? "desc" : "asc";
  return (
    <th className={`py-2 pr-3 first:pl-4 last:pl-3 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Sort by ${label}, ${nextDir}ending`}
        className={SORT_TRIGGER_CLASS}
      >
        <SortLabel label={label} active={active} direction={direction} />
      </button>
    </th>
  );
}

/** A body row — `align-top` throughout, since more than one of these tables stacks multi-line cell content. */
export function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-ground/5 align-top last:border-0 hover:bg-ground/5">
      {children}
    </tr>
  );
}
