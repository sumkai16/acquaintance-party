import { Table, Th, Tr, SortHeaderLink } from "../table";
import { Stat } from "../stat";
import {
  cashPaymentsSummary,
  listAdminEmails,
  listApprovedForSectionReport,
  onlinePaymentsSummary,
  pendingTicketEmailCount,
  searchRegistrations,
} from "@/lib/registrations/queries";
import { approvedCount, totalCollectedCentavos } from "@/lib/scans/queries";
import { listAllProfileNames } from "@/lib/profiles/queries";
import { sortRegistrations, type RegistrationSortColumn } from "@/lib/registrations/sort";
import { buildSectionReport } from "@/lib/registrations/section-report";
import { formatPeso } from "@/lib/config/event";
import { RegistrationRow } from "./registration-row";
import { RegistrationFilters } from "./registration-filters";
import { SendTicketEmails } from "./send-ticket-emails";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const VALID_STATUSES = ["pending", "approved", "rejected"] as const;
const VALID_PAYMENT_METHODS = ["walk_in", "online"] as const;
const SORT_COLUMNS: readonly RegistrationSortColumn[] = ["name", "amount", "submitted"];

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    paymentMethod?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { q = "", status: rawStatus, paymentMethod: rawPaymentMethod, sort, dir } =
    await searchParams;
  // No status in the URL means "all" — populated by default, same as
  // Attendance's Recent Scans needing no filter picked to show something.
  const status = VALID_STATUSES.includes(rawStatus as (typeof VALID_STATUSES)[number])
    ? (rawStatus as (typeof VALID_STATUSES)[number])
    : "all";
  const paymentMethod = VALID_PAYMENT_METHODS.includes(
    rawPaymentMethod as (typeof VALID_PAYMENT_METHODS)[number],
  )
    ? (rawPaymentMethod as (typeof VALID_PAYMENT_METHODS)[number])
    : "all";

  // One round trip, not four. The row search and the event-wide totals do
  // not depend on each other, and awaiting them in sequence meant the page
  // paid Singapore's latency once per query — see the reviewer lookups below
  // for the one dependency that genuinely has to come second.
  //
  // The totals are independent of whatever search/filter is active, the same
  // "always show the real number" reasoning as the Attendance and Cash
  // pages' own stat cards.
  const [
    rawResults,
    totalPayees,
    totalCentavos,
    cash,
    online,
    approvedForReport,
    unemailed,
  ] = await Promise.all([
    searchRegistrations(q, status, paymentMethod),
    approvedCount(),
    totalCollectedCentavos(),
    cashPaymentsSummary(),
    onlinePaymentsSummary(),
    listApprovedForSectionReport(),
    pendingTicketEmailCount(),
  ]);

  const sortColumn = SORT_COLUMNS.includes(sort as RegistrationSortColumn)
    ? (sort as RegistrationSortColumn)
    : null;
  const direction = dir === "asc" ? "asc" : "desc";
  const results = sortColumn ? sortRegistrations(rawResults, sortColumn, direction) : rawResults;

  // Only needed to label a rejected row with who rejected it, or a walk-in
  // row with who added it. Both are keyed on `reviewed_by`, so a page where
  // no row has one — every row still pending, the common case early on —
  // needs neither. That is a sharper test than "are there any rows at all",
  // and it matters most for listAdminEmails: it calls the Supabase Auth
  // admin API, the slowest single call on this page.
  const needsReviewers = results.some((registration) => registration.reviewed_by);
  const [adminEmails, profileNames] = needsReviewers
    ? await Promise.all([listAdminEmails(), listAllProfileNames()])
    : [new Map<string, string>(), new Map<string, string>()];
  const sectionReport = buildSectionReport(approvedForReport);

  return (
    <main className="mx-auto w-full max-w-5xl p-6 2xl:max-w-7xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Dashboard</h1>
        <p className="text-ground/60">
          Where the money and the payees stand. Search by name or email, or
          filter by status.
        </p>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total payees" value={totalPayees} />
        <Stat label="Total amount" value={formatPeso(totalCentavos)} />
        <Stat label="Total cash" value={formatPeso(cash.totalCentavos)} />
        <Stat label="Total GCash" value={formatPeso(online.totalCentavos)} />
      </dl>

      <SendTicketEmails pending={unemailed} />

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
                    <Th>Added by</Th>
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
                addedByName={
                  registration.payment_method === "walk_in" && registration.reviewed_by
                    ? (profileNames.get(registration.reviewed_by) ?? null)
                    : null
                }
              />
            ))}
          </tbody>
        </Table>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">By year level &amp; section</h2>
        <p className="text-sm text-ground/60">
          Approved payees only. A section not on the school&apos;s list shows up under
          &ldquo;Other&rdquo; instead of being left out of the count.
        </p>

        <div className="mt-3 grid gap-6 md:grid-cols-2">
          {sectionReport.map((year) => {
            const yearTotal = year.sections.reduce(
              (acc, s) => ({
                count: acc.count + s.count,
                totalCentavos: acc.totalCentavos + s.totalCentavos,
              }),
              { count: 0, totalCentavos: 0 },
            );

            return (
              <div key={year.yearLevel}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ground/70">
                  {year.yearLevel}
                </h3>
                <Table>
                  <thead>
                    <tr className="text-left">
                      <Th>Section</Th>
                      <Th>Payees</Th>
                      <Th>Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {year.sections.map((section) => (
                      <Tr key={section.section}>
                        <td className="py-2 pr-3 pl-4 font-medium">{section.section}</td>
                        <td className="py-2 pr-3 tabular-nums">{section.count}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {formatPeso(section.totalCentavos)}
                        </td>
                      </Tr>
                    ))}
                    <Tr>
                      <td className="py-2 pr-3 pl-4 font-semibold">Total</td>
                      <td className="py-2 pr-3 font-semibold tabular-nums">{yearTotal.count}</td>
                      <td className="py-2 pr-3 font-semibold tabular-nums">
                        {formatPeso(yearTotal.totalCentavos)}
                      </td>
                    </Tr>
                  </tbody>
                </Table>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
