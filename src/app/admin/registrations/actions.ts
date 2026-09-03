"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";
import { currentAdminId } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string };

/**
 * Frees a student's ID for a fresh submission without going through Review
 * Queue's own reject flow, which only ever sees pending rows. This works on
 * an approved row too — the whole point is covering the case Review Queue
 * can't: a student needs a legitimate do-over after their ticket already
 * went through.
 *
 * Rejecting is what actually unlocks the slot: the migration's partial
 * unique index on registrations(student_id) excludes rejected rows, so this
 * needs no separate "reactivation" state of its own.
 */
export async function voidRegistration(
  id: string,
  reason: string,
): Promise<ActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Give a reason the student can act on." };

  const { error } = await adminClient()
    .from("registrations")
    .update({
      status: "rejected",
      reject_reason: trimmed,
      ticket_code: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    })
    .eq("id", id)
    .neq("status", "rejected");

  if (error) {
    console.error("voidRegistration failed", error);
    return { ok: false, error: "Could not void this registration. Try again." };
  }

  revalidatePath("/admin/registrations");
  return { ok: true };
}
