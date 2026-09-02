"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { findNameCollision, normalizeImportRow } from "@/lib/raffle/entrants";
import {
  deleteExtraEntrant,
  eligiblePool,
  insertExtraEntrant,
  insertExtraEntrantsBatch,
} from "@/lib/raffle/queries";
import type { RaffleEntrant } from "@/lib/raffle/types";
import { currentAdminId } from "@/lib/supabase/server";

const MAX_IMPORT_ROWS = 500;

const NAME_HEADERS = ["full name", "name", "student name"];
const YEAR_HEADERS = ["year level", "year"];
const SECTION_HEADERS = ["section"];

export type AddEntrantResult =
  | { ok: true; entrant: RaffleEntrant; warning: string | null }
  | { ok: false; error: string };

export async function addEntrant(input: {
  fullName: string;
  yearLevel?: string;
  section?: string;
}): Promise<AddEntrantResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const row = normalizeImportRow(input);
  if (!row) return { ok: false, error: "Enter a name (2–120 characters)." };

  const pool = await eligiblePool();
  // A coincidental name match must not block a real case — this is a
  // heads-up for the admin, not a gate.
  const collision = findNameCollision(pool, row.fullName);

  const result = await insertExtraEntrant(row, adminId, "manual");
  if (!result.ok) return result;

  revalidatePath("/admin/raffle");
  return {
    ok: true,
    entrant: result.entrant,
    warning: collision
      ? `“${row.fullName}” is close to an existing entrant (${collision.fullName}, ${collision.source === "ticket" ? "already checked in" : "already added"}). Added anyway — remove it if this is a duplicate.`
      : null,
  };
}

export async function removeEntrant(id: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const result = await deleteExtraEntrant(id);
  if (result.ok) revalidatePath("/admin/raffle");
  return result;
}

export type ImportEntrantsResult =
  | { ok: true; added: RaffleEntrant[]; skipped: number; warnings: string[] }
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
 * Bulk-imports names from an uploaded .xlsx. Expects a header row; matches
 * "Full name" (or "Name"), and optionally "Year level" and "Section",
 * case-insensitively — see docs/setup for the exact format this expects.
 */
export async function importEntrants(formData: FormData): Promise<ImportEntrantsResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a file first." };

  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's own .d.ts shadows the global Buffer with a local
    // `Buffer extends ArrayBuffer` stub that doesn't structurally match a
    // real Node Buffer under current lib types (missing the newer
    // resizable-ArrayBuffer members) — a type-only mismatch upstream, not a
    // runtime one, since load() just reads bytes.
    const buffer = Buffer.from(await file.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
  } catch (error) {
    console.error("importEntrants: could not read the file", error);
    return { ok: false, error: "Could not read that file as an Excel workbook." };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return { ok: false, error: "That sheet has no rows below the header." };
  }

  const headerRow = sheet.getRow(1);
  const nameCol = columnIndex(headerRow, NAME_HEADERS);
  if (!nameCol) {
    return {
      ok: false,
      error: 'No "Full name" column found in the header row. Check the spelling and try again.',
    };
  }
  const yearCol = columnIndex(headerRow, YEAR_HEADERS);
  const sectionCol = columnIndex(headerRow, SECTION_HEADERS);

  if (sheet.rowCount - 1 > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `That sheet has more than ${MAX_IMPORT_ROWS} rows. Split it and import in batches.`,
    };
  }

  const rows: ReturnType<typeof normalizeImportRow>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push(
      normalizeImportRow({
        fullName: row.getCell(nameCol).value,
        yearLevel: yearCol ? row.getCell(yearCol).value : undefined,
        section: sectionCol ? row.getCell(sectionCol).value : undefined,
      }),
    );
  });

  const valid = rows.filter((row) => row !== null);
  const skipped = rows.length - valid.length;

  const pool = await eligiblePool();
  const warnings: string[] = [];
  for (const row of valid) {
    const collision = findNameCollision(pool, row.fullName);
    if (collision) {
      warnings.push(
        `“${row.fullName}” is close to an existing entrant (${collision.fullName}).`,
      );
    }
  }

  const inserted = await insertExtraEntrantsBatch(valid, adminId);
  if (!inserted.ok) return inserted;

  revalidatePath("/admin/raffle");
  return { ok: true, added: inserted.entrants, skipped, warnings };
}
