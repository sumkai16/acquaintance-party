import ExcelJS from "exceljs";
import { EVENT } from "@/lib/config/event";
import { formatDateTimePH, startOfTodayPH } from "@/lib/format/datetime";
import { totalCashCollectedCentavos } from "@/lib/cash/queries";
import { onlinePaymentsSummary } from "@/lib/registrations/queries";
import { listExpenses, spentCentavos } from "@/lib/expenses/queries";
import { expenseBalances } from "@/lib/expenses/parse";
import { adminOnlyResponse } from "../route-auth";

/**
 * Every expense, voided ones included and marked, plus a Summary sheet with
 * the same four figures as the page's cards. Amounts are plain peso numbers
 * so the columns can be summed in Excel to check against the cards.
 */
export async function GET() {
  const denied = await adminOnlyResponse();
  if (denied) return denied;

  let expenses, spent, cashCollected, gcashCollected;
  try {
    [expenses, spent, cashCollected, gcashCollected] = await Promise.all([
      listExpenses(),
      spentCentavos(),
      totalCashCollectedCentavos(),
      onlinePaymentsSummary(),
    ]);
  } catch (error) {
    // A half-filled workbook would look like a good record until someone
    // relied on it — fail with nothing attached instead.
    console.error("expenses export failed", error);
    return Response.json(
      { error: "Could not read expenses. Nothing was exported." },
      { status: 500 },
    );
  }

  const balances = expenseBalances({
    cashCollectedCentavos: cashCollected,
    gcashCollectedCentavos: gcashCollected.totalCentavos,
    cashSpentCentavos: spent.cashCentavos,
    gcashSpentCentavos: spent.gcashCentavos,
  });

  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("Expenses");
  sheet.columns = [
    { header: "Date & time", key: "spentAt", width: 22 },
    { header: "Item", key: "item", width: 32 },
    { header: "Amount", key: "amount", width: 12 },
    { header: "Method", key: "method", width: 10 },
    { header: "Added by", key: "addedBy", width: 24 },
    { header: "Status", key: "status", width: 10 },
    { header: "Voided by", key: "voidedBy", width: 24 },
    { header: "Voided at", key: "voidedAt", width: 22 },
    { header: "Void reason", key: "voidReason", width: 32 },
    { header: "Has receipt", key: "hasReceipt", width: 12 },
    { header: "Recorded at", key: "createdAt", width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  // Filter dropdowns on every header — Status is the one that matters
  // (Active / Voided), but the rest cost nothing and help an auditor.
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

  for (const expense of expenses) {
    const voided = expense.voided_at !== null;
    sheet.addRow({
      spentAt: formatDateTimePH(expense.spent_at),
      item: expense.item_name,
      amount: expense.amount / 100,
      method: expense.method === "cash" ? "Cash" : "GCash",
      addedBy: expense.addedByName,
      status: voided ? "Voided" : "Active",
      voidedBy: expense.voidedByName ?? "",
      voidedAt: expense.voided_at ? formatDateTimePH(expense.voided_at) : "",
      voidReason: expense.void_reason ?? "",
      hasReceipt: expense.receipt_path ? "Yes" : "No",
      createdAt: formatDateTimePH(expense.created_at),
    });
  }
  sheet.getColumn("amount").numFmt = "#,##0.00";

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Figure", key: "label", width: 22 },
    { header: "Amount", key: "amount", width: 14 },
  ];
  summary.getRow(1).font = { bold: true };
  summary.addRows([
    { label: "Cash collected", amount: cashCollected / 100 },
    { label: "Cash spent", amount: spent.cashCentavos / 100 },
    { label: "Total Cash", amount: balances.totalCashCentavos / 100 },
    { label: "GCash collected", amount: gcashCollected.totalCentavos / 100 },
    { label: "GCash spent", amount: spent.gcashCentavos / 100 },
    { label: "Total GCash", amount: balances.totalGcashCentavos / 100 },
    { label: "Total Amount", amount: balances.totalAmountCentavos / 100 },
    { label: "Total Expenses", amount: balances.totalExpensesCentavos / 100 },
  ]);
  summary.getColumn("amount").numFmt = "#,##0.00";
  summary.addRow({});
  summary.addRow({ label: "Exported at", amount: formatDateTimePH(new Date().toISOString()) });

  const buffer = await workbook.xlsx.writeBuffer();
  const date = startOfTodayPH().slice(0, 10);
  const filename = `${EVENT.name.toLowerCase().replace(/\s+/g, "-")}-expenses-${date}.xlsx`;

  return new Response(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
