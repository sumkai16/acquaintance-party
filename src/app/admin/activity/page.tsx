import { formatPeso } from "@/lib/config/event";
import { listActivity, type ActivityFilters as Filters } from "@/lib/activity/queries";
import { ACTIVITY_TYPES, describeActivity, type ActivityType } from "@/lib/activity/types";
import { listAllProfiles } from "@/lib/profiles/queries";
import { formatDatePH, formatTimePH, startOfTodayPH } from "@/lib/format/datetime";
import { Table, Th, Tr } from "../table";
import { ActivityFilters } from "./activity-filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity" };

const VALID_RANGES = ["today", "yesterday", "week", "month", "custom"] as const;

function phDateOnlyIso(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}T00:00:00+08:00`;
}

function addDaysPH(iso: string, days: number): string {
  return phDateOnlyIso(new Date(new Date(iso).getTime() + days * 86_400_000));
}

function phWeekdayIndexMondayFirst(iso: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "short",
  }).format(new Date(iso));
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
}

function resolveDateRange(
  range: string,
  from: string,
  to: string,
): { fromIso?: string; toIso?: string } {
  const todayIso = startOfTodayPH();
  switch (range) {
    case "today":
      return { fromIso: todayIso, toIso: addDaysPH(todayIso, 1) };
    case "yesterday":
      return { fromIso: addDaysPH(todayIso, -1), toIso: todayIso };
    case "week": {
      const mondayOffset = phWeekdayIndexMondayFirst(todayIso);
      return { fromIso: addDaysPH(todayIso, -mondayOffset), toIso: addDaysPH(todayIso, 1) };
    }
    case "month": {
      const [y, m] = todayIso.split("-");
      return { fromIso: `${y}-${m}-01T00:00:00+08:00`, toIso: addDaysPH(todayIso, 1) };
    }
    case "custom":
      return {
        fromIso: from ? `${from}T00:00:00+08:00` : undefined,
        toIso: to ? addDaysPH(`${to}T00:00:00+08:00`, 1) : undefined,
      };
    default:
      return {};
  }
}

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
  }>;
}) {
  const { range: rawRange, from = "", to = "", userId, activityType: rawType, q } =
    await searchParams;
  const range = VALID_RANGES.includes(rawRange as (typeof VALID_RANGES)[number])
    ? (rawRange as (typeof VALID_RANGES)[number])
    : "";
  const activityType = ACTIVITY_TYPES.includes(rawType as ActivityType)
    ? (rawType as ActivityType)
    : undefined;

  const { fromIso, toIso } = range ? resolveDateRange(range, from, to) : {};

  const filters: Filters = {
    userId: userId || undefined,
    activityType,
    fromIso,
    toIso,
    query: q || undefined,
  };

  const [logs, profiles] = await Promise.all([listActivity(filters), listAllProfiles()]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));

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
      </div>
    </main>
  );
}
