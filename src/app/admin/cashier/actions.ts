"use server";

import { revalidatePath } from "next/cache";
import { currentProfile } from "@/lib/supabase/server";
import { createRemittance } from "@/lib/remittances/queries";
import { logActivity } from "@/lib/activity/queries";
import { formatPeso } from "@/lib/config/event";

export type ActionResult = { ok: boolean; error?: string };

export async function submitRemittance(amountCentavos: number): Promise<ActionResult> {
  const profile = await currentProfile();
  if (!profile || profile.role !== "staff") {
    return { ok: false, error: "Sign in again." };
  }
  if (!Number.isInteger(amountCentavos) || amountCentavos <= 0) {
    return { ok: false, error: "Enter a valid amount." };
  }

  const result = await createRemittance(profile.id, amountCentavos);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "exceeds_available"
          ? "You can't remit more than your available collected cash."
          : "Something went wrong. Try again in a moment.",
    };
  }

  await logActivity({
    userId: profile.id,
    activityType: "remittance_submitted",
    description: `${profile.fullName} submitted a cash remittance of ${formatPeso(amountCentavos)}`,
    remittanceId: result.id,
    amount: amountCentavos,
  });

  revalidatePath("/admin/cashier");
  return { ok: true };
}
