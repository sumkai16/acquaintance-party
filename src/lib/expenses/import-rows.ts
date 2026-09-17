import type { ExpenseMethod } from "@/lib/supabase/types";
import { manilaLocalToIso, parsePesoToCentavos } from "./parse";

export const EXPENSE_IMPORT_HEADERS = {
  item: ["item name", "item", "description"],
  amount: ["amount", "amount (php)", "amount (₱)"],
  method: ["payment method", "method"],
  date: ["date & time", "date and time", "date", "date/time"],
} as const;

export type ExpenseImportData = {
  itemName: string;
  amountCentavos: number;
  method: ExpenseMethod;
  spentAtIso: string;
};

export type RawExpenseCells = {
  item: string;
  amount: string | number | null;
  method: string;
  date: string | Date | null;
};

export type ExpenseImportRow = {
  rowNumber: number;
  raw: { item: string; amount: string; method: string; date: string };
  ok: boolean;
  data?: ExpenseImportData;
  error?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

function normalizeMethod(raw: string): ExpenseMethod | null {
  const key = raw.trim().toLowerCase().replace(/[\s-]/g, "");
  if (key === "cash") return "cash";
  if (key === "gcash") return "gcash";
  return null;
}

/**
 * ExcelJS hands back a real date cell as a `Date` whose UTC fields hold the
 * wall-clock time typed into the sheet — so those fields are read as Manila
 * local time, not converted from UTC.
 */
function dateCellToLocal(value: Date): string {
  return (
    `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}` +
    `T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`
  );
}

function textDateToLocal(text: string): string | null {
  const match = text.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (!match) return null;
  const [, y, mo, d, h = "0", mi = "00"] = match;
  return `${y}-${pad(Number(mo))}-${pad(Number(d))}T${pad(Number(h))}:${mi}`;
}

function displayDate(value: string | Date | null): string {
  if (value instanceof Date) return dateCellToLocal(value).replace("T", " ");
  return value ?? "";
}

/** Every column of a row is empty — the tail of a filled-in template, skipped silently. */
export function isBlankRow(cells: RawExpenseCells): boolean {
  return (
    !cells.item &&
    (cells.amount === null || cells.amount === "") &&
    !cells.method &&
    (cells.date === null || cells.date === "")
  );
}

/** Validates one spreadsheet row with the same rules the Add expense form uses. */
export function validateExpenseRow(rowNumber: number, cells: RawExpenseCells): ExpenseImportRow {
  const raw = {
    item: cells.item,
    amount: cells.amount === null ? "" : String(cells.amount),
    method: cells.method,
    date: displayDate(cells.date),
  };
  const fail = (error: string): ExpenseImportRow => ({ rowNumber, raw, ok: false, error });

  const itemName = cells.item.trim();
  if (itemName.length < 2 || itemName.length > 120) {
    return fail("Item name must be 2–120 characters.");
  }

  const amountCentavos =
    typeof cells.amount === "number"
      ? parsePesoToCentavos(cells.amount.toFixed(2))
      : parsePesoToCentavos(cells.amount ?? "");
  if (amountCentavos === null) return fail("Amount must be a positive peso amount.");

  const method = normalizeMethod(cells.method);
  if (!method) return fail("Payment method must be Cash or GCash.");

  const local =
    cells.date instanceof Date ? dateCellToLocal(cells.date) : textDateToLocal(cells.date ?? "");
  if (!local) return fail("Date must be like 2026-10-03 18:30.");
  const spentAtIso = manilaLocalToIso(local);
  if (!spentAtIso) return fail("Date can't be in the future.");

  return { rowNumber, raw, ok: true, data: { itemName, amountCentavos, method, spentAtIso } };
}

/**
 * Re-checks a row the client held onto between Parse and Confirm — the
 * server never trusts that it's still what parsing produced.
 */
export function isValidImportData(data: ExpenseImportData): boolean {
  const spentAt = new Date(data.spentAtIso);
  return (
    typeof data.itemName === "string" &&
    data.itemName.trim().length >= 2 &&
    data.itemName.trim().length <= 120 &&
    Number.isInteger(data.amountCentavos) &&
    data.amountCentavos > 0 &&
    data.amountCentavos <= 100_000_000 &&
    (data.method === "cash" || data.method === "gcash") &&
    !Number.isNaN(spentAt.getTime()) &&
    spentAt.getTime() <= Date.now() + 5 * 60 * 1000
  );
}
