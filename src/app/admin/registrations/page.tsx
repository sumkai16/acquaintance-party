import { Table, Th, SortHeaderLink } from "../table";
import { listAdminEmails, searchRegistrations } from "@/lib/registrations/queries";
import { sortRegistrations, type RegistrationSortColumn } from "@/lib/registrations/sort";
import { RegistrationRow } from "./registration-row";
import { RegistrationFilters } from "./registration-filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find a registration" };

const VALID_STATUSES = ["pending", "approved", "rejected"] as const;
const SORT_COLUMNS: readonly RegistrationSortColumn[] = ["name", "amount", "submitted"];

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; dir?: string }>;
}) {
  const { q = "", status: rawStatus, sort, dir } = await searchParams;
  // No status in the URL means "all" — populated by default, same as
  // Attendance's Recent Scans needing no filter picked to show something.
  const status = VALID_STATUSES.includes(rawStatus as (typeof VALID_STATUSES)[number])
    ? (rawStatus as (typeof VALID_STATUSES)[number])
    : "all";

  const rawResults = await searchRegistrations(q, status);
  const sortColumn = SORT_COLUMNS.includes(sort as RegistrationSortColumn)
    ? (sort as RegistrationSortColumn)
    : null;
  const direction = dir === "asc" ? "asc" : "desc";
  const results = sortColumn ? sortRegistrations(rawResults, sortColumn, direction) : rawResults;

  // Only needed to label a rejected row with who rejected it — skip the
  // lookup entirely on an empty results page.
  const adminEmails = results.length > 0 ? await listAdminEmails() : new Map<string, string>();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header>
        <h1 className="font-display text-3xl uppercase">Find a registration</h1>
        <p className="text-ground/60">
          Search by name or email, or filter by status.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Results</h2>
        <RegistrationFilters />
      </div>

      <div className="mt-2">
        <Table
          empty={
            results.length === 0
              ? q.trim().length >= 2
                ? `Nothing matches “${q}”.`
                : status === "all"
                  ? "No registrations yet."
                  : `No ${status} registrations.`
              : undefined
          }
        >
          <thead>
            <tr className="text-left">
              {(() => {
                const sortHref = (col: RegistrationSortColumn) => {
                  const active = sortColumn === col;
                  const nextDir = active && direction === "asc" ? "desc" : "asc";
                  const params = new URLSearchParams();
                  params.set("sort", col);
                  params.set("dir", nextDir);
                  if (q) params.set("q", q);
                  if (status !== "all") params.set("status", status);
                  return { href: `?${params.toString()}`, active };
                };
                // Header order matches RegistrationRow's <td> order exactly —
                // Payment/Status/Ticket code/Actions aren't sortable, so
                // they're interleaved as plain Th rather than following one
                // contiguous sortable block.
                return (
                  <>
                    <SortHeaderLink label="Name" {...sortHref("name")} direction={direction} />
                    <SortHeaderLink label="Amount" {...sortHref("amount")} direction={direction} />
                    <Th>Payment</Th>
                    <SortHeaderLink
                      label="Submitted"
                      {...sortHref("submitted")}
                      direction={direction}
                    />
                    <Th>Status</Th>
                    <Th>Ticket code</Th>
                    <Th>Actions</Th>
                  </>
                );
              })()}
            </tr>
          </thead>
          <tbody>
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
          </tbody>
        </Table>
      </div>
    </main>
  );
}
