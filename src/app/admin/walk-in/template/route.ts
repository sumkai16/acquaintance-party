import ExcelJS from "exceljs";
import { STUDENT_ID_PLACEHOLDER } from "@/lib/registrations/schema";
import { SECTIONS_BY_YEAR, YEAR_LEVELS } from "@/lib/registrations/sections";
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
    studentId: STUDENT_ID_PLACEHOLDER,
    yearLevel: "1st year",
    section: "A",
    email: "juan@example.com",
  });

  // Section is validated against the year level on import, so a row with a
  // section that year doesn't have is rejected at review. Spelling the
  // allowed values out here saves a round trip of failed uploads.
  const reference = workbook.addWorksheet("Valid sections");
  reference.columns = [
    { header: "Year level", key: "yearLevel", width: 14 },
    { header: "Sections", key: "sections", width: 32 },
  ];
  reference.getRow(1).font = { bold: true };
  for (const yearLevel of YEAR_LEVELS) {
    reference.addRow({
      yearLevel,
      sections: SECTIONS_BY_YEAR[yearLevel].join(", "),
    });
  }

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
