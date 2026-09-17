"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getProfile } from "@/lib/profiles/queries";
import { formatPeso } from "@/lib/config/event";
import { logActivities, logActivity } from "@/lib/activity/queries";
import { voidImportBatch } from "@/lib/import-batches/queries";

export type ActionResult = { ok: true; voided: number } | { ok: false; error: string };

/**
 * Voids every still-active ticket from one bulk import. Admin-only — the
 * page is admin-only through the layout, but a server action can be called
 * on its own, so the role is checked here too.
 */
export async function voidImport(batchId: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admins only." };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Give a reason." };
  if (trimmed.length > 300) return { ok: false, error: "Keep the reason under 300 characters." };

  const result = await voidImportBatch(batchId, admin.id, trimmed);
  if (!result.ok) {
    const messages = {
      not_found: "That import no longer exists.",
      already_voided: "Every ticket from this import is already voided.",
      failed: "Could not void this import. Try again.",
    };
    return { ok: false, error: messages[result.error] };
  }

  const { voided, batch } = result;
  const total = voided.reduce((sum, row) => sum + row.amount, 0);

  // One row per ticket, same wording as a single Dashboard void, so
  // searching a student's name in Activity still finds why their ticket died.
  await logActivities(
    voided.map((row) => ({
      userId: admin.id,
      activityType: "registration_voided" as const,
      description: `Voided registration for ${row.full_name} (${row.student_id}) with import "${batch.file_name}": ${trimmed}`,
      registrationId: row.id,
      amount: row.amount,
    })),
  );

  const uploader = await getProfile(batch.uploaded_by);
  await logActivity({
    userId: admin.id,
    activityType: "import_voided",
    description: `${admin.fullName} voided import "${batch.file_name}" by ${uploader?.fullName ?? "unknown"} — ${voided.length} ticket${voided.length === 1 ? "" : "s"}, ${formatPeso(total)}: ${trimmed}`,
    amount: total,
  });

  revalidatePath("/admin/imports");
  revalidatePath(`/admin/imports/${batchId}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/cash");
  return { ok: true, voided: voided.length };
}
