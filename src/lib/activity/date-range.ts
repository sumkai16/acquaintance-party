import { startOfTodayPH } from "@/lib/format/datetime";

/**
 * Shared by every activity-log filter bar (admin's system-wide log, staff's
 * own-activity log) — resolves a range preset plus optional custom bounds
 * into the `fromIso`/`toIso` pair `listActivity` expects, all in
 * Asia/Manila local days regardless of the server's own timezone.
 */
export const VALID_RANGES = ["today", "yesterday", "week", "month", "custom"] as const;
export type ActivityRange = (typeof VALID_RANGES)[number];

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

export function resolveDateRange(
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
