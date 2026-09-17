const TIME_ZONE = "Asia/Manila";
const MAX_PESOS = 1_000_000;
// A clock a few minutes fast, or a submit that lands just after the
// datetime-local value was read, must not get rejected as "the future."
const FUTURE_SLACK_MS = 5 * 60 * 1000;

/**
 * Parses a peso amount typed as text ("150", "1,250.75") into centavos.
 * Returns null for anything that isn't a positive amount with at most 2
 * decimal places, or that exceeds a sane per-expense ceiling — the same
 * "centavos, never a float" rule every money column in the schema follows.
 */
export function parsePesoToCentavos(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const pesos = Number(cleaned);
  if (!Number.isFinite(pesos) || pesos <= 0 || pesos > MAX_PESOS) return null;

  return Math.round(pesos * 100);
}

/**
 * Converts a `<input type="datetime-local">` value ("2026-10-03T18:30") to
 * an ISO instant in Manila's fixed UTC+8 offset — same approach as
 * startOfTodayPH() in src/lib/format/datetime.ts. Returns null for a
 * malformed value or a time more than a few minutes in the future, since an
 * expense is something that already happened.
 */
export function manilaLocalToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;

  const iso = `${value}:00+08:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getTime() > Date.now() + FUTURE_SLACK_MS) return null;

  return iso;
}

/** Default value for the "date & time" field — right now, in Manila. */
export function nowManilaLocal(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export type ExpenseBalanceInputs = {
  cashCollectedCentavos: number;
  gcashCollectedCentavos: number;
  cashSpentCentavos: number;
  gcashSpentCentavos: number;
};

export type ExpenseBalances = {
  totalCashCentavos: number;
  totalGcashCentavos: number;
  totalAmountCentavos: number;
  totalExpensesCentavos: number;
};

/**
 * The four Expenses-page card values. A pure function of collected vs.
 * spent so it's testable without a database — and deliberately allowed to
 * go negative (an admin can overspend a method), not clamped to zero like
 * currentCollectionCentavos in src/lib/cash/balances.ts. Clamping here would
 * hide a real overspend from the one page whose job is to surface it.
 */
export function expenseBalances(inputs: ExpenseBalanceInputs): ExpenseBalances {
  const totalCashCentavos = inputs.cashCollectedCentavos - inputs.cashSpentCentavos;
  const totalGcashCentavos = inputs.gcashCollectedCentavos - inputs.gcashSpentCentavos;
  return {
    totalCashCentavos,
    totalGcashCentavos,
    totalAmountCentavos: totalCashCentavos + totalGcashCentavos,
    totalExpensesCentavos: inputs.cashSpentCentavos + inputs.gcashSpentCentavos,
  };
}
