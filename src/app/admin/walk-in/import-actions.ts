"use server";

import ExcelJS from "exceljs";
import { EVENT } from "@/lib/config/event";
import {
  normalizeStudentId,
  walkInSchema,
  YEAR_LEVELS,
  type WalkInInput,
} from "@/lib/registrations/schema";
import {
  createWalkInRegistration,
  findActiveStudentIds,
} from "@/lib/registrations/queries";
import { currentAdminId, currentProfile } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/queries";
import { cellText, columnIndex } from "@/lib/import/excel-cells";
import { finishImportBatch, startImportBatch } from "@/lib/import-batches/queries";
import { revalidatePath } from "next/cache";
import { issueReceiptOrLog } from "@/lib/receipts/queries";
import { scheduleWalkInTicketEmail } from "./notify";

/** Lower than the raffle import's 500 — each row here is a real financial
 * transaction and a real email send, not just a name. */
const MAX_IMPORT_ROWS = 200;

const NAME_HEADERS = ["full name", "name", "student name"];
const STUDENT_ID_HEADERS = ["student id", "student id no", "id number", "id"];
const YEAR_HEADERS = ["year level", "year"];
const SECTION_HEADERS = ["section"];
const EMAIL_HEADERS = ["email", "email address"];

export type ParsedWalkInRow = {
  rowNumber: number;
  raw: { fullName: string; studentId: string; yearLevel: string; section: string; email: string };
  ok: boolean;
  data?: WalkInInput;
  error?: string;
};

export type ParseImportResult =
  | { ok: true; rows: ParsedWalkInRow[] }
  | { ok: false; error: string };

/** "1st Year", "1ST YEAR" -> "1st year" — only when it's a case-only typo
 * of a real year level; anything else passes through for the schema's own
 * enum error to catch. */
function normalizeYearLevel(raw: string): string {
  const match = YEAR_LEVELS.find((level) => level.toLowerCase() === raw.toLowerCase());
  return match ?? raw;
}

/**
 * Parses an uploaded .xlsx into rows ready for review — nothing is written
 * to the database here. Mirrors the raffle import's header-matching and
 * row-cap pattern (src/app/admin/raffle/entrant-actions.ts), but every row
 * runs through the same `walkInSchema` the one-at-a-time form uses, so an
 * import error reads exactly like a form error.
 */
export async function parseWalkInImport(formData: FormData): Promise<ParseImportResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a file first." };

  const workbook = new ExcelJS.Workbook();
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
  } catch (error) {
    console.error("parseWalkInImport: could not read the file", error);
    return { ok: false, error: "Could not read that file as an Excel workbook." };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return { ok: false, error: "That sheet has no rows below the header." };
  }

  const headerRow = sheet.getRow(1);
  const nameCol = columnIndex(headerRow, NAME_HEADERS);
  const studentIdCol = columnIndex(headerRow, STUDENT_ID_HEADERS);
  const yearCol = columnIndex(headerRow, YEAR_HEADERS);
  const sectionCol = columnIndex(headerRow, SECTION_HEADERS);
  const emailCol = columnIndex(headerRow, EMAIL_HEADERS);

  const missing = [
    !nameCol && "Full name",
    !studentIdCol && "Student ID",
    !yearCol && "Year level",
    !sectionCol && "Section",
    !emailCol && "Email",
  ].filter(Boolean);
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing column(s) in the header row: ${missing.join(", ")}. Check the spelling and try again.`,
    };
  }

  if (sheet.rowCount - 1 > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `That sheet has more than ${MAX_IMPORT_ROWS} rows. Split it and import in batches.`,
    };
  }

  const parsed: { rowNumber: number; raw: ParsedWalkInRow["raw"] }[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw = {
      fullName: cellText(row, nameCol),
      // Normalized here, not just in the schema: the duplicate-in-file
      // count and the findActiveStudentIds() lookup below both compare this
      // raw value, and an ID typed in lowercase in the spreadsheet would
      // miss both checks and then fail at insert instead.
      studentId: normalizeStudentId(cellText(row, studentIdCol)),
      yearLevel: normalizeYearLevel(cellText(row, yearCol)),
      section: cellText(row, sectionCol),
      email: cellText(row, emailCol),
    };
    // A fully blank row (common at the end of a filled-in template) is
    // silently skipped rather than reported as an error — every other
    // field being empty too isn't a mistake worth flagging.
    if (!raw.fullName && !raw.studentId && !raw.email) return;
    parsed.push({ rowNumber, raw });
  });

  const studentIdCounts = new Map<string, number>();
  for (const { raw } of parsed) {
    if (!raw.studentId) continue;
    studentIdCounts.set(raw.studentId, (studentIdCounts.get(raw.studentId) ?? 0) + 1);
  }

  const existingIds = await findActiveStudentIds(
    parsed.map(({ raw }) => raw.studentId).filter(Boolean),
  );

  const rows: ParsedWalkInRow[] = parsed.map(({ rowNumber, raw }) => {
    if (raw.studentId && (studentIdCounts.get(raw.studentId) ?? 0) > 1) {
      return { rowNumber, raw, ok: false, error: "Duplicate student ID in this file." };
    }
    if (raw.studentId && existingIds.has(raw.studentId)) {
      return { rowNumber, raw, ok: false, error: "Already has a ticket." };
    }

    const result = walkInSchema.safeParse(raw);
    if (!result.success) {
      return { rowNumber, raw, ok: false, error: result.error.issues[0]?.message ?? "Invalid row." };
    }
    return { rowNumber, raw, ok: true, data: result.data };
  });

  return { ok: true, rows };
}

export type ConfirmImportResult = {
  created: number;
  failed: { row: WalkInInput; error: string }[];
  /** Set when nothing was attempted at all — the rows are untouched. */
  error?: string;
};

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Creates one approved registration per row the admin kept checked after
 * review — the exact same per-row path submitWalkIn uses
 * (createWalkInRegistration, the walk_in_payment_added activity log, the
 * ticket email), just looped. Re-validates every row server-side rather
 * than trusting what the client held onto since parsing.
 *
 * FormData carries `rows` (JSON) and the original `file` again. The file is
 * stored as an import batch before any ticket is created, and every ticket
 * is tagged with that batch, so an admin can later see what was uploaded
 * and void the whole import in one step (/admin/imports).
 */
export async function confirmWalkInImport(formData: FormData): Promise<ConfirmImportResult> {
  let rows: WalkInInput[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
    if (!Array.isArray(rows)) throw new Error("rows is not an array");
  } catch {
    return { created: 0, failed: [], error: "Could not read the rows. Parse the file again." };
  }

  const adminId = await currentAdminId();
  if (!adminId) return { created: 0, failed: [], error: "Sign in again." };
  if (rows.length === 0) return { created: 0, failed: [], error: "Nothing selected to import." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { created: 0, failed: [], error: `Import at most ${MAX_IMPORT_ROWS} rows at once.` };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { created: 0, failed: [], error: "The file is missing. Choose it again and re-parse." };
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return { created: 0, failed: [], error: "Keep the file under 5 MB." };
  }

  const batch = await startImportBatch(adminId, file);
  if (!batch.ok) {
    return {
      created: 0,
      failed: [],
      error: "Could not save a copy of the file, so nothing was imported. Try again.",
    };
  }

  const { created, failed } = await recordImportedRows(adminId, rows, batch.id);

  await finishImportBatch(batch.id, created, failed.length);
  if (created > 0) revalidatePath("/admin/imports");
  return { created, failed };
}

/**
 * The per-row work both entry points share — the Excel import above and the
 * typed list below: create the approved cash registration, issue its receipt,
 * queue the ticket email, log the activity. Re-validates every row here
 * rather than trusting what the client held onto.
 */
async function recordImportedRows(
  adminId: string,
  rows: WalkInInput[],
  batchId: string,
): Promise<{ created: number; failed: ConfirmImportResult["failed"] }> {
  const profile = await currentProfile();
  const failed: ConfirmImportResult["failed"] = [];
  let created = 0;

  for (const row of rows) {
    const parsed = walkInSchema.safeParse(row);
    if (!parsed.success) {
      failed.push({ row, error: parsed.error.issues[0]?.message ?? "Invalid row." });
      continue;
    }

    const result = await createWalkInRegistration({
      ...parsed.data,
      amount: EVENT.ticketPriceCentavos,
      reviewedBy: adminId,
      importBatchId: batchId,
    });

    if (!result.ok) {
      failed.push({
        row,
        error:
          result.error === "duplicate_student_id"
            ? "Already has a ticket."
            : "Something went wrong saving this ticket.",
      });
      continue;
    }

    created += 1;
    const receiptIds = await issueReceiptOrLog({
      registrationId: result.id,
      fullName: parsed.data.fullName,
      amount: EVENT.ticketPriceCentavos,
      method: "cash",
      balanceAfter: 0,
      receivedBy: adminId,
      paidAt: new Date().toISOString(),
    });
    scheduleWalkInTicketEmail(adminId, {
      to: parsed.data.email,
      fullName: parsed.data.fullName,
      ticketId: result.id,
      // Bulk import never creates a partial row, so ticketCode is always
      // set here — the null case only exists for the walk-in partial-payment
      // path this call never takes.
      ticketCode: result.ticketCode ?? undefined,
      receiptIds,
    });
    await logActivity({
      userId: adminId,
      activityType: "walk_in_payment_added",
      description: `${profile?.fullName ?? "Someone"} recorded a walk-in payment for ${parsed.data.fullName} (${parsed.data.studentId}) (import)`,
      registrationId: result.id,
      amount: EVENT.ticketPriceCentavos,
    });
  }

  return { created, failed };
}

/**
 * Which of these student IDs already hold an active ticket — the one check
 * the typed list can't do in the browser. Normalizes first, same as the
 * Excel parse, so a lowercase ID still matches.
 */
export async function findTicketedStudentIds(studentIds: string[]): Promise<string[]> {
  const adminId = await currentAdminId();
  if (!adminId) return [];

  const normalized = studentIds.slice(0, MAX_IMPORT_ROWS).map(normalizeStudentId).filter(Boolean);
  const existing = await findActiveStudentIds(normalized);
  return normalized.filter((id) => existing.has(id));
}

/**
 * Same columns as the downloadable template, so a typed batch's file in
 * /admin/imports opens and re-imports like any uploaded sheet. It exists
 * because a batch always keeps a file (import_batches.file_path is NOT NULL,
 * and the audit page downloads it) — here it's generated from the typed rows.
 */
async function typedRowsToFile(rows: WalkInInput[]): Promise<File> {
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
  for (const row of rows) sheet.addRow(row);

  const buffer = await workbook.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  return new File([buffer], `Typed entry ${stamp}.xlsx`, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * Records the rows typed into the quick-entry list. Same batch, audit file
 * and per-row path as an Excel import, so "void this whole sheet" in
 * /admin/imports works on it too.
 */
export async function confirmTypedWalkIns(rows: WalkInInput[]): Promise<ConfirmImportResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { created: 0, failed: [], error: "Sign in again." };
  if (!Array.isArray(rows) || rows.length === 0) {
    return { created: 0, failed: [], error: "Nothing to record." };
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return { created: 0, failed: [], error: `Record at most ${MAX_IMPORT_ROWS} rows at once.` };
  }

  // Validated before the batch exists, so a bad row never leaves an
  // empty batch or a stray file behind. recordImportedRows checks again.
  const valid: WalkInInput[] = [];
  const failed: ConfirmImportResult["failed"] = [];
  for (const row of rows) {
    const parsed = walkInSchema.safeParse(row);
    if (parsed.success) valid.push(parsed.data);
    else failed.push({ row, error: parsed.error.issues[0]?.message ?? "Invalid row." });
  }
  if (valid.length === 0) return { created: 0, failed };

  const batch = await startImportBatch(adminId, await typedRowsToFile(valid));
  if (!batch.ok) {
    return {
      created: 0,
      failed: [],
      error: "Could not save a copy of the list, so nothing was recorded. Try again.",
    };
  }

  const recorded = await recordImportedRows(adminId, valid, batch.id);
  failed.push(...recorded.failed);

  await finishImportBatch(batch.id, recorded.created, failed.length);
  if (recorded.created > 0) revalidatePath("/admin/imports");
  return { created: recorded.created, failed };
}
