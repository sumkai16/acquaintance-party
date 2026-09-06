import { formatPeso } from "@/lib/config/event";
import {
  ACTIVITY_PAGE_SIZE,
  listActivity,
  type ActivityFilters as Filters,
} from "@/lib/activity/queries";
import { ACTIVITY_TYPES, describeActivity, type ActivityType } from "@/lib/activity/types";
import { VALID_RANGES, resolveDateRange } from "@/lib/activity/date-range";
import { listAllProfiles } from "@/lib/profiles/queries";
import { formatDatePH, formatTimePH } from "@/lib/format/datetime";
import { Table, Th, Tr } from "../table";
import { Pagination } from "../pagination";
import { ActivityFilters } from "./activity-filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    userId?: string;
    activityType?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const { range: rawRange, from = "", to = "", userId, activityType: rawType, q } = params;
  const range = VALID_RANGES.includes(rawRange as (typeof VALID_RANGES)[number])
    ? (rawRange as (typeof VALID_RANGES)[number])
    : "";
  const activityType = ACTIVITY_TYPES.includes(rawType as ActivityType)
    ? (rawType as ActivityType)
    : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  const { fromIso, toIso } = range ? resolveDateRange(range, from, to) : {};

  const filters: Filters = {
    userId: userId || undefined,
    activityType,
    fromIso,
    toIso,
    query: q || undefined,
  };

  const [{ logs, total }, profiles] = await Promise.all([
    listActivity(filters, page),
    listAllProfiles(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  function buildHref(targetPage: number) {
    const next = new URLSearchParams();
    if (range) next.set("range", range);
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    if (userId) next.set("userId", userId);
    if (activityType) next.set("activityType", activityType);
    if (q) next.set("q", q);
    if (targetPage > 1) next.set("page", String(targetPage));
    const qs = next.toString();
    return qs ? `/admin/activity?${qs}` : "/admin/activity";
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-6 2xl:max-w-7xl">
      <header>
        <h1 className="font-display text-3xl uppercase">Activity</h1>
        <p className="text-ground/60">
          Every login, walk-in payment, approval, and remittance action, system-wide.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Log</h2>
        <ActivityFilters accounts={profiles} />
      </div>

      <div className="mt-2">
        <Table empty={logs.length === 0 ? "No activity matches these filters." : undefined}>
          <thead>
            <tr>
              <Th>Activity Type</Th>
              <Th>Description</Th>
              <Th>User</Th>
              <Th>Role</Th>
              <Th>Amount</Th>
              <Th>Date</Th>
              <Th>Time</Th>
              <Th>Transaction</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const profile = log.user_id ? profileById.get(log.user_id) : undefined;
              return (
                <Tr key={log.id}>
                  <td className="py-2 pr-3 pl-4 font-medium">
                    {describeActivity(log.activity_type)}
                  </td>
                  <td className="py-2 pr-3">{log.description}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{profile?.fullName ?? "System"}</td>
                  <td className="py-2 pr-3 whitespace-nowrap capitalize">
                    {profile?.role ?? "—"}
                  </td>
                  <td className="py-2 pr-3 tabular-nums whitespace-nowrap">
                    {log.amount != null ? formatPeso(log.amount) : "—"}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDatePH(log.created_at)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatTimePH(log.created_at)}</td>
                  <td className="py-2 pr-3 font-mono whitespace-nowrap">
                    {(log.registration_id ?? log.remittance_id)
                      ? (log.registration_id ?? log.remittance_id)!.slice(0, 8).toUpperCase()
                      : "—"}
                  </td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
        <Pagination page={page} totalPages={totalPages} buildHref={buildHref} />
      </div>
    </main>
  );
}
