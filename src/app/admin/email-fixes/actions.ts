"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ONLY_ERROR, requireAdmin } from "@/lib/auth/require-admin";
import { resolveEmailFixRequest } from "@/lib/email-fixes/queries";

export type ActionResult = { ok: boolean; error?: string };

/**
 * Bookkeeping only — the actual fix happens on the Dashboard's edit flow,
 * which is requireAdmin()-gated and not in staff's nav at all. Matching that
 * here rather than defaulting to Walk-in's staff-open access level, since a
 * "resolved" queue whose fix step staff can't reach would be confusing, not
 * convenient.
 */
export async function resolveEmailFix(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: ADMIN_ONLY_ERROR };

  const result = await resolveEmailFixRequest(id, admin.id);
  if (!result.ok) return result;

  revalidatePath("/admin/email-fixes");
  return { ok: true };
}
