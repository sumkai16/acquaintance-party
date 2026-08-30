import ExcelJS from "exceljs";
import { serverClient } from "@/lib/supabase/server";
import { allScans } from "@/lib/scans/queries";
import { EVENT } from "@/lib/config/event";

export async function GET() {
  const { data } = await (await serverClient()).auth.getUser();
  if (!data.user) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }

  const scans = await allScans();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");
  sheet.columns = [
    { header: "Scanned at", key: "scannedAt", width: 22 },
    { header: "Name", key: "fullName", width: 28 },
    { header: "Result", key: "result", width: 12 },
    { header: "Door", key: "deviceLabel", width: 12 },
    { header: "Code", key: "codeScanned", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const scan of scans) {
    sheet.addRow({
      scannedAt: new Date(scan.scannedAt).toLocaleString("en-PH"),
      fullName: scan.fullName ?? "",
      result: scan.result,
      deviceLabel: scan.deviceLabel,
      codeScanned: scan.codeScanned,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${EVENT.name.toLowerCase().replace(/\s+/g, "-")}-attendance.xlsx`;

  return new Response(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
