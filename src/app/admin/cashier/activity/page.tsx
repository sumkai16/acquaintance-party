import { redirect } from "next/navigation";
import { formatPeso } from "@/lib/config/event";
import { currentProfile } from "@/lib/supabase/server";
import { listActivity } from "@/lib/activity/queries";
import { ACTIVITY_TYPES, describeActivity, type ActivityType } from "@/lib/activity/types";
import { VALID_RANGES, resolveDateRange } from "@/lib/activity/date-range";
import { formatDateTimePH } from "@/lib/format/datetime";
import { Table, Th, Tr } from "../../table";
import { ActivityFilters } from "../../activity/activity-filters";

export const metadata = { title: "My Activity" };
export const dynamic = "force-dynamic";

export default async function CashierActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    activityType?: string;
    q?: string;
  }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/admin/login");

  const { range: rawRange, from = "", to = "", activityType: rawType, q } = await searchParams;
  const range = VALID_RANGES.includes(rawRange as (typeof VALID_RANGES)[number])
    ? (rawRange as (typeof VALID_RANGES)[number])
    : "";
  const activityType = ACTIVITY_TYPES.includes(rawType as ActivityType)
    ? (rawType as ActivityType)
    : undefined;
  const { fromIso, toIso } = range ? resolveDateRange(range, from, to) : {};

  const logs = await listActivity({
    userId: profile.id,
    activityType,
    fromIso,
    toIso,
    query: q || undefined,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase">My Activity</h1>
      <p className="mt-1 text-ground/70">
        A read-only record of your own actions — you can&apos;t edit or delete these.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Log</h2>
        <ActivityFilters />
      </div>

      <div className="mt-2">
        <Table empty={logs.length === 0 ? "No activity matches these filters." : undefined}>
          <thead>
            <tr>
              <Th>Activity</Th>
              <Th>Description</Th>
              <Th>Amount</Th>
              <Th>Date &amp; Time</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <Tr key={log.id}>
                <td className="py-2 pr-3 pl-4 font-medium">{describeActivity(log.activity_type)}</td>
                <td className="py-2 pr-3">{log.description}</td>
                <td className="py-2 pr-3 tabular-nums">
                  {log.amount != null ? formatPeso(log.amount) : "—"}
                </td>
                <td className="py-2 pr-3 last:pl-3">{formatDateTimePH(log.created_at)}</td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </main>
  );
}
