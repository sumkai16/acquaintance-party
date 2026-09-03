import ExcelJS from "exceljs";
import { serverClient } from "@/lib/supabase/server";
import { allScans } from "@/lib/scans/queries";
import { filterScans } from "@/lib/scans/report";
import { EVENT } from "@/lib/config/event";

export async function GET(request: Request) {
  const { data } = await (await serverClient()).auth.getUser();
  if (!data.user) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }

  // Same name/year/section/door filters as the dashboard table, so
  // "download .xlsx" from a filtered view exports exactly what's on screen
  // — omit all four for the full, unfiltered list.
  const params = new URL(request.url).searchParams;
  const name = params.get("name") ?? undefined;
  const year = params.get("year") ?? undefined;
  const section = params.get("section") ?? undefined;
  const door = params.get("door") ?? undefined;

  // Duplicates and invalids matter live, on the dashboard, where an admin is
  // watching for problems. In an exported attendance list they're just noise
  // — this file answers "who actually got in," not "every scan attempted."
  const scans = filterScans(
    (await allScans()).filter((scan) => scan.result === "ok"),
    { name, year, section, door },
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");
  sheet.columns = [
    { header: "Scanned at", key: "scannedAt", width: 22 },
    { header: "Name", key: "fullName", width: 28 },
    { header: "Year level", key: "yearLevel", width: 14 },
    { header: "Section", key: "section", width: 14 },
    { header: "Result", key: "result", width: 12 },
    { header: "Door", key: "deviceLabel", width: 12 },
    { header: "Code", key: "codeScanned", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const scan of scans) {
    sheet.addRow({
      scannedAt: new Date(scan.scannedAt).toLocaleString("en-PH"),
      fullName: scan.fullName ?? "",
      yearLevel: scan.yearLevel ?? "",
      section: scan.section ?? "",
      result: scan.result,
      deviceLabel: scan.deviceLabel,
      codeScanned: scan.codeScanned,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filenameParts = [
    EVENT.name.toLowerCase().replace(/\s+/g, "-"),
    "attendance",
    ...(section ? [section.toLowerCase().replace(/\s+/g, "-")] : []),
    ...(year ? [year.toLowerCase().replace(/\s+/g, "-")] : []),
    ...(door ? [door.toLowerCase().replace(/\s+/g, "-")] : []),
  ];
  const filename = `${filenameParts.join("-")}.xlsx`;

  return new Response(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
