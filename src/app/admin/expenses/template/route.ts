import ExcelJS from "exceljs";
import { adminOnlyResponse } from "../../route-auth";

export async function GET() {
  const denied = await adminOnlyResponse();
  if (denied) return denied;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Expenses");
  sheet.columns = [
    { header: "Item name", key: "item", width: 32 },
    { header: "Amount", key: "amount", width: 12 },
    { header: "Payment method", key: "method", width: 16 },
    { header: "Date & time", key: "date", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };
  // Typed as text, not a real date cell, so it reads the same in every
  // spreadsheet app and locale. Real date cells are accepted on import too.
  sheet.addRow({ item: "Tarpaulin printing", amount: 350, method: "Cash", date: "2026-10-01 14:30" });
  sheet.getColumn("date").numFmt = "@";

  const notes = workbook.addWorksheet("How to fill in");
  notes.columns = [
    { header: "Column", key: "column", width: 18 },
    { header: "What to enter", key: "rule", width: 60 },
  ];
  notes.getRow(1).font = { bold: true };
  notes.addRows([
    { column: "Item name", rule: "2–120 characters." },
    { column: "Amount", rule: "Pesos, up to 2 decimal places. No ₱ sign needed." },
    { column: "Payment method", rule: "Cash or GCash." },
    { column: "Date & time", rule: "YYYY-MM-DD HH:MM in 24-hour time, e.g. 2026-10-01 14:30. Not in the future." },
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="expenses-template.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
