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
