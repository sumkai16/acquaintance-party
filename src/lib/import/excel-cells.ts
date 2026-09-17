import type ExcelJS from "exceljs";

/** The column number whose header (row 1) matches one of `aliases`, case-insensitively. */
export function columnIndex(headerRow: ExcelJS.Row, aliases: string[]): number | null {
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
export function cellText(row: ExcelJS.Row, col: number | null): string {
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
