/**
 * The payments open/closed flag, in its pure form.
 *
 * Fail-closed by design: only the exact string "true" opens the payment
 * line. A missing settings row, a null value, or anything unrecognized
 * reads as closed — an unconfigured payment gate should not accept money.
 * Kept separate from queries.ts (server-only) so this decision is unit
 * testable; see context/RULES.md on the server-only split.
 */
export function readOpenFlag(value: string | null): boolean {
  return value === "true";
}
