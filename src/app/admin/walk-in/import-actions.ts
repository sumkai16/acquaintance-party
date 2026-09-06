"use server";

import ExcelJS from "exceljs";
import { EVENT } from "@/lib/config/event";
import { walkInSchema, YEAR_LEVELS, type WalkInInput } from "@/lib/registrations/schema";
import {
  createWalkInRegistration,
  findActiveStudentIds,
} from "@/lib/registrations/queries";
import { currentAdminId, currentProfile } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/queries";
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

function columnIndex(headerRow: ExcelJS.Row, aliases: string[]): number | null {
  let found: number | null = null;
  headerRow.eachCell((cell, colNumber) => {
    if (found !== null) return;
    const text = String(cell.value ?? "").trim().toLowerCase();
    if (aliases.includes(text)) found = colNumber;
  });
  return found;
}

/**
 * Excel auto-links anything that looks like an email or URL the moment it's
 * typed into a cell, which ExcelJS represents as `{ text, hyperlink }`
 * rather than a plain string — `String(value)` on that object was
 * producing the literal text "[object Object]" instead of the address.
 * Also handles rich-text cells (`{ richText: [...] }`), the other common
 * non-string shape a "plain" typed cell can come back as.
 */
function cellText(row: ExcelJS.Row, col: number | null): string {
  if (!col) return "";
  const value = row.getCell(col).value as unknown;
  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    const rich = value as { text?: unknown; richText?: { text?: unknown }[]; hyperlink?: unknown };
    if (typeof rich.text === "string") return rich.text.trim();
    if (Array.isArray(rich.richText)) {
      return rich.richText.map((part) => String(part.text ?? "")).join("").trim();
    }
    if (typeof rich.hyperlink === "string") return rich.hyperlink.trim();
    return "";
  }

  return String(value).trim();
}

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
      studentId: cellText(row, studentIdCol),
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
      return { rowNumber, raw, ok: false, error: "Already has an active registration." };
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
};

/**
 * Creates one approved registration per row the admin kept checked after
 * review — the exact same per-row path submitWalkIn uses
 * (createWalkInRegistration, the walk_in_payment_added activity log, the
 * ticket email), just looped. Re-validates every row server-side rather
 * than trusting what the client held onto since parsing.
 */
export async function confirmWalkInImport(rows: WalkInInput[]): Promise<ConfirmImportResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { created: 0, failed: rows.map((row) => ({ row, error: "Sign in again." })) };

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
    });

    if (!result.ok) {
      failed.push({
        row,
        error:
          result.error === "duplicate_student_id"
            ? "Already has an active registration."
            : "Something went wrong saving this ticket.",
      });
      continue;
    }

    created += 1;
    scheduleWalkInTicketEmail(adminId, {
      to: parsed.data.email,
      fullName: parsed.data.fullName,
      ticketId: result.id,
    });
    await logActivity({
      userId: adminId,
      activityType: "walk_in_payment_added",
      description: `${profile?.fullName ?? "Someone"} recorded a walk-in payment for ${parsed.data.fullName} (${parsed.data.studentId})`,
      registrationId: result.id,
      amount: EVENT.ticketPriceCentavos,
    });
  }

  return { created, failed };
}
