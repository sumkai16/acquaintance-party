"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { formatPeso } from "@/lib/config/event";
import { logActivity } from "@/lib/activity/queries";
import { cellText, columnIndex } from "@/lib/import/excel-cells";
import { createExpense } from "@/lib/expenses/queries";
import {
  EXPENSE_IMPORT_HEADERS,
  isBlankRow,
  isValidImportData,
  validateExpenseRow,
  type ExpenseImportData,
  type ExpenseImportRow,
  type RawExpenseCells,
} from "@/lib/expenses/import-rows";

const MAX_IMPORT_ROWS = 200;

export type ParseExpenseImportResult =
  | { ok: true; rows: ExpenseImportRow[] }
  | { ok: false; error: string };

/** A formula cell (e.g. `=120*3`) comes back as `{ formula, result }` — use its computed result. */
function rawCellValue(row: ExcelJS.Row, col: number | null): unknown {
  if (!col) return null;
  const value = row.getCell(col).value as unknown;
  if (value && typeof value === "object" && "result" in value) {
    return (value as { result: unknown }).result;
  }
  return value;
}

/**
 * Reads an uploaded .xlsx into rows for review. Writes nothing — the admin
 * unticks anything wrong and confirms separately, same flow as the Walk-in
 * bulk import.
 */
export async function parseExpenseImport(formData: FormData): Promise<ParseExpenseImportResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Admins only." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file first." };

  const workbook = new ExcelJS.Workbook();
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
  } catch (error) {
    console.error("parseExpenseImport: could not read the file", error);
    return { ok: false, error: "Could not read that file as an Excel workbook." };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return { ok: false, error: "That sheet has no rows below the header." };
  }

  const header = sheet.getRow(1);
  const itemCol = columnIndex(header, [...EXPENSE_IMPORT_HEADERS.item]);
  const amountCol = columnIndex(header, [...EXPENSE_IMPORT_HEADERS.amount]);
  const methodCol = columnIndex(header, [...EXPENSE_IMPORT_HEADERS.method]);
  const dateCol = columnIndex(header, [...EXPENSE_IMPORT_HEADERS.date]);

  const missing = [
    !itemCol && "Item name",
    !amountCol && "Amount",
    !methodCol && "Payment method",
    !dateCol && "Date & time",
  ].filter(Boolean);
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing column(s) in the header row: ${missing.join(", ")}. Use the template's headers.`,
    };
  }

  if (sheet.rowCount - 1 > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `That sheet has more than ${MAX_IMPORT_ROWS} rows. Split it and import in batches.`,
    };
  }

  const rows: ExpenseImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const amountValue = rawCellValue(row, amountCol);
    const dateValue = rawCellValue(row, dateCol);
    const cells: RawExpenseCells = {
      item: cellText(row, itemCol),
      amount: typeof amountValue === "number" ? amountValue : cellText(row, amountCol),
      method: cellText(row, methodCol),
      date: dateValue instanceof Date ? dateValue : cellText(row, dateCol),
    };
    if (isBlankRow(cells)) return;
    rows.push(validateExpenseRow(rowNumber, cells));
  });

  if (rows.length === 0) return { ok: false, error: "That sheet has no filled-in rows." };
  return { ok: true, rows };
}

export type ConfirmExpenseImportResult = {
  created: number;
  failed: { data: ExpenseImportData; error: string }[];
  error?: string;
};

/**
 * Saves the rows the admin kept ticked. Re-validates each one server-side,
 * and writes a single summary activity row for the batch rather than one
 * per expense, so a large import doesn't bury the rest of the log.
 */
export async function confirmExpenseImport(
  rows: ExpenseImportData[],
): Promise<ConfirmExpenseImportResult> {
  const admin = await requireAdmin();
  if (!admin) return { created: 0, failed: [], error: "Admins only." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { created: 0, failed: [], error: `Import at most ${MAX_IMPORT_ROWS} rows at once.` };
  }

  const failed: ConfirmExpenseImportResult["failed"] = [];
  let created = 0;
  let totalCentavos = 0;

  for (const data of rows) {
    if (!isValidImportData(data)) {
      failed.push({ data, error: "Row is no longer valid. Re-parse the file." });
      continue;
    }
    const result = await createExpense({
      itemName: data.itemName.trim(),
      amountCentavos: data.amountCentavos,
      method: data.method,
      spentAtIso: data.spentAtIso,
      addedBy: admin.id,
    });
    if (!result.ok) {
      failed.push({ data, error: "Something went wrong saving this row." });
      continue;
    }
    created += 1;
    totalCentavos += data.amountCentavos;
  }

  if (created > 0) {
    await logActivity({
      userId: admin.id,
      activityType: "expense_added",
      description: `${admin.fullName} imported ${created} expense${created === 1 ? "" : "s"} totaling ${formatPeso(totalCentavos)} from Excel`,
      amount: totalCentavos,
    });
    revalidatePath("/admin/expenses");
  }

  return { created, failed };
}
