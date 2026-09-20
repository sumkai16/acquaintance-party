"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ONLY_ERROR, requireAdmin } from "@/lib/auth/require-admin";
import { deleteAcknowledgement } from "@/lib/faculty/queries";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Removes one entry from the faculty list.
 *
 * Gated on requireAdmin() rather than the layout alone: a server action is a
 * POST endpoint reachable without ever loading the page, so the layout's
 * staff allowlist does not cover it. Same rule as every other admin action —
 * see src/lib/auth/require-admin.ts.
 */
export async function removeFacultyEntry(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: ADMIN_ONLY_ERROR };

  const result = await deleteAcknowledgement(id);
  if (!result.ok) return result;

  revalidatePath("/admin/faculty");
  revalidatePath("/admin/raffle");
  return { ok: true };
}
