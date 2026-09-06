"use server";

import { revalidatePath } from "next/cache";
import { currentProfile } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { approveRemittance, rejectRemittance } from "@/lib/remittances/queries";
import { getProfile } from "@/lib/profiles/queries";
import { logActivity } from "@/lib/activity/queries";
import { formatPeso } from "@/lib/config/event";

export type ActionResult = { ok: boolean; error?: string };

async function requireAdmin() {
  const profile = await currentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}

export async function approve(remittanceId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admins only." };

  const { data: remittance } = await adminClient()
    .from("cash_remittances")
    .select("staff_id, amount")
    .eq("id", remittanceId)
    .maybeSingle();

  const result = await approveRemittance(remittanceId, admin.id);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "already_resolved"
          ? "This remittance was already approved or rejected."
          : "Something went wrong. Try again.",
    };
  }

  const staffProfile = remittance ? await getProfile(remittance.staff_id) : null;
  await logActivity({
    userId: admin.id,
    activityType: "remittance_approved",
    description: `${admin.fullName} approved ${staffProfile?.fullName ?? "a staff member"}'s remittance of ${formatPeso(remittance?.amount ?? 0)}`,
    remittanceId,
    amount: remittance?.amount,
  });

  revalidatePath("/admin/cash");
  return { ok: true };
}

export async function reject(remittanceId: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admins only." };
  if (!reason.trim()) return { ok: false, error: "Give a reason." };
  if (reason.trim().length > 300) {
    return { ok: false, error: "Keep the reason under 300 characters." };
  }

  const { data: remittance } = await adminClient()
    .from("cash_remittances")
    .select("staff_id, amount")
    .eq("id", remittanceId)
    .maybeSingle();

  const result = await rejectRemittance(remittanceId, reason.trim());
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "already_resolved"
          ? "This remittance was already approved or rejected."
          : "Something went wrong. Try again.",
    };
  }

  const staffProfile = remittance ? await getProfile(remittance.staff_id) : null;
  await logActivity({
    userId: admin.id,
    activityType: "remittance_rejected",
    description: `${admin.fullName} rejected ${staffProfile?.fullName ?? "a staff member"}'s remittance of ${formatPeso(remittance?.amount ?? 0)}: ${reason.trim()}`,
    remittanceId,
    amount: remittance?.amount,
  });

  revalidatePath("/admin/cash");
  return { ok: true };
}
