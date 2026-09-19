"use server";

import { currentAdminId } from "@/lib/supabase/server";
import { saveWalkInDraft } from "@/lib/walk-in-drafts/queries";
import { sanitizeDraftRows } from "@/lib/walk-in-drafts/sanitize";

export type SaveDraftResult = { ok: true; savedAt: string } | { ok: false };

/**
 * Keeps the typed list on the server so it can be picked up from another
 * phone. Never throws: the list is already safe in this phone's browser, so a
 * failed save is reported as `{ ok: false }` and the screen just says so.
 * The rows come from the browser, so they are cleaned before they are stored.
 */
export async function saveWalkInDraftAction(rows: unknown): Promise<SaveDraftResult> {
  try {
    const adminId = await currentAdminId();
    if (!adminId) return { ok: false };

    const savedAt = await saveWalkInDraft(adminId, sanitizeDraftRows(rows));
    return savedAt ? { ok: true, savedAt } : { ok: false };
  } catch (error) {
    console.error("saveWalkInDraftAction failed", error);
    return { ok: false };
  }
}
