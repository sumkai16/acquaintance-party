import ExcelJS from "exceljs";
import { currentAdminId } from "@/lib/supabase/server";

export async function GET() {
  const adminId = await currentAdminId();
  if (!adminId) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Walk-in sales");
  sheet.columns = [
    { header: "Full name", key: "fullName", width: 28 },
    { header: "Student ID", key: "studentId", width: 20 },
    { header: "Year level", key: "yearLevel", width: 14 },
    { header: "Section", key: "section", width: 12 },
    { header: "Email", key: "email", width: 28 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    fullName: "Juan Dela Cruz",
    studentId: "SCC-00-0000000",
    yearLevel: "1st year",
    section: "A",
    email: "juan@example.com",
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="walk-in-template.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
