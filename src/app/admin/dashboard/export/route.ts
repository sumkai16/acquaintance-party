import ExcelJS from "exceljs";
import { EVENT } from "@/lib/config/event";
import { formatDateTimePH } from "@/lib/format/datetime";
import { getProfile, listAllProfileNames } from "@/lib/profiles/queries";
import { allRegistrations, listAdminEmails } from "@/lib/registrations/queries";
import { currentAdminId } from "@/lib/supabase/server";

/**
 * The whole registrations table as one .xlsx — the off-Supabase copy of the
 * money record.
 *
 * The attendance export next door answers "who got in." This one answers
 * "who paid, how much, and who approved it," which is the part that exists
 * nowhere else: the scan manifest on the door phones holds ticket codes but
 * no payees, and the Google Sheet mirrors scans only. On the free plan there
 * is no point-in-time recovery, so a dropped table or a deleted project is
 * unrecoverable without a file somebody already downloaded.
 *
 * Admin-only, unlike the attendance export, which any signed-in user can
 * pull. Every payee's email address and payment reference in a single
 * portable file is a different thing to hand out than a check-in list, and
 * staff have no reason to hold it.
 */
export async function GET() {
  const userId = await currentAdminId();
  if (!userId) {
    return Response.json({ error: "Sign in again." }, { status: 401 });
  }
  const profile = await getProfile(userId);
  if (profile?.role !== "admin") {
    return Response.json({ error: "Admins only." }, { status: 403 });
  }

  let registrations;
  try {
    registrations = await allRegistrations();
  } catch {
    // Loudly, with nothing attached. A half-written or empty workbook would
    // be indistinguishable from a good backup until the day it gets opened.
    return Response.json(
      { error: "Could not read the registrations table. Nothing was exported." },
      { status: 500 },
    );
  }

  // Same two lookups the dashboard uses to name a reviewer: staff and admins
  // live in `profiles`, but an admin who reviewed before that table existed
  // is only in Supabase Auth. Falling back to the raw id would leave a
  // column of uuids in the one file meant to be readable without the app.
  const [profileNames, adminEmails] = await Promise.all([
    listAllProfileNames(),
    listAdminEmails(),
  ]);
  const reviewerName = (id: string | null) =>
    id ? (profileNames.get(id) ?? adminEmails.get(id) ?? id) : "";

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Registrations");
  sheet.columns = [
    { header: "Submitted", key: "submitted", width: 22 },
    { header: "Name", key: "fullName", width: 28 },
    { header: "Student ID", key: "studentId", width: 18 },
    { header: "Year level", key: "yearLevel", width: 12 },
    { header: "Section", key: "section", width: 12 },
    { header: "Email", key: "email", width: 30 },
    { header: "Status", key: "status", width: 12 },
    { header: "Payment", key: "paymentMethod", width: 12 },
    { header: "Amount", key: "amount", width: 12 },
    { header: "GCash reference", key: "gcashReference", width: 22 },
    { header: "Ticket code", key: "ticketCode", width: 18 },
    { header: "Reviewed at", key: "reviewedAt", width: 22 },
    { header: "Reviewed by", key: "reviewedBy", width: 24 },
    { header: "Reject reason", key: "rejectReason", width: 30 },
    { header: "Ticket emailed", key: "ticketEmailed", width: 22 },
    { header: "Receipt path", key: "receiptPath", width: 34 },
    { header: "Registration id", key: "id", width: 38 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const registration of registrations) {
    sheet.addRow({
      submitted: formatDateTimePH(registration.created_at),
      fullName: registration.full_name,
      studentId: registration.student_id,
      yearLevel: registration.year_level,
      section: registration.section,
      email: registration.email,
      status: registration.status,
      paymentMethod: registration.payment_method,
      // Pesos as a real number, not the ₱-prefixed string the app shows, so
      // the column can just be summed in Excel to check the night's total
      // against the cash box. Centavos are the storage unit, not this one.
      amount: registration.amount / 100,
      gcashReference: registration.gcash_reference ?? "",
      ticketCode: registration.ticket_code ?? "",
      reviewedAt: registration.reviewed_at
        ? formatDateTimePH(registration.reviewed_at)
        : "",
      reviewedBy: reviewerName(registration.reviewed_by),
      rejectReason: registration.reject_reason ?? "",
      ticketEmailed: registration.ticket_email_sent_at
        ? formatDateTimePH(registration.ticket_email_sent_at)
        : "",
      // The path, not the image. Enough to find the receipt in the bucket
      // later; embedding hundreds of photos would make the file too large
      // to keep on a phone, which is where a backup actually needs to live.
      receiptPath: registration.receipt_path ?? "",
      id: registration.id,
    });
  }

  sheet.getColumn("amount").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  // Dated, because the point is to keep several and know which is newest.
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${EVENT.name.toLowerCase().replace(/\s+/g, "-")}-registrations-${stamp}.xlsx`;

  return new Response(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
