import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { sanitizeDraftRows, type DraftRow, type WalkInDraft } from "./sanitize";

/**
 * This staff member's unfinished Walk-in list: the draft, `null` when there
 * definitely isn't one, or `undefined` when it couldn't be read at all. The
 * two are told apart on purpose — "none" means the sheet was finished on
 * another phone and this phone's old copy should go, while "couldn't read"
 * means keep whatever this phone has rather than lose it.
 *
 * Read through the service-role client because the table has no policies at
 * all (see 0016_walk_in_drafts.sql). Sanitized again on the way out: what is
 * stored was already cleaned on the way in, but the page shouldn't depend on
 * nobody ever having edited the row by hand.
 */
export async function getWalkInDraft(userId: string): Promise<WalkInDraft | null | undefined> {
  const { data, error } = await adminClient()
    .from("walk_in_drafts")
    .select("rows, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // The page must still load if the table isn't there yet (code shipped
    // before the migration) — the list then just falls back to this phone.
    console.error("getWalkInDraft failed", error);
    return undefined;
  }
  if (!data) return null;

  const rows = sanitizeDraftRows(data.rows);
  return rows.length > 0 ? { rows, updatedAt: data.updated_at as string } : null;
}

/**
 * Replaces this staff member's draft. An empty list deletes the row, so a
 * finished sheet leaves nothing behind. Returns the new timestamp, or null if
 * it couldn't be saved.
 */
export async function saveWalkInDraft(userId: string, rows: DraftRow[]): Promise<string | null> {
  if (rows.length === 0) {
    const { error } = await adminClient().from("walk_in_drafts").delete().eq("user_id", userId);
    if (error) {
      console.error("saveWalkInDraft: delete failed", error);
      return null;
    }
    return new Date().toISOString();
  }

  const updatedAt = new Date().toISOString();
  const { error } = await adminClient()
    .from("walk_in_drafts")
    .upsert({ user_id: userId, rows, updated_at: updatedAt }, { onConflict: "user_id" });
  if (error) {
    console.error("saveWalkInDraft: upsert failed", error);
    return null;
  }
  return updatedAt;
}
