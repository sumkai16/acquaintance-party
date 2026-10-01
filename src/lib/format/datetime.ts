const TIME_ZONE = "Asia/Manila";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatDatePH(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatTimePH(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDateTimePH(iso: string): string {
  return `${formatDatePH(iso)}, ${formatTimePH(iso)}`;
}

/** Start of "today" in Manila, as a UTC ISO instant — for date-range filters. */
export function startOfTodayPH(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  // Manila is a fixed UTC+8 offset (no DST) — safe to hardcode.
  return `${y}-${m}-${d}T00:00:00+08:00`;
}

/** Today in Manila as a bare "2026-09-30" — the value a date input holds. */
export function todayPH(): string {
  return startOfTodayPH().slice(0, 10);
}

/** "2026-09-30" moved by whole days — calendar math only, no timezone involved. */
export function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * One Manila calendar day as a half-open [fromIso, toIso) range, for a
 * "paid on" filter. Null for anything that isn't a real date — a hand-edited
 * `?paidOn=2026-02-30` is dropped, not rolled over into March.
 */
export function manilaDayBounds(day: string): { fromIso: string; toIso: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return {
    fromIso: `${day}T00:00:00+08:00`,
    toIso: `${shiftDay(day, 1)}T00:00:00+08:00`,
  };
}
