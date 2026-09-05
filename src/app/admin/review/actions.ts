"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { generateTicketCode } from "@/lib/tickets/generate";
import { adminClient } from "@/lib/supabase/admin";
import { currentAdminId } from "@/lib/supabase/server";
import { sendTicketApprovedEmail } from "@/lib/notify/email";

const UNIQUE_VIOLATION = "23505";

export type ActionResult = { ok: boolean; error?: string };

export async function approveRegistration(id: string): Promise<ActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  // Retry on the vanishingly unlikely ticket-code collision rather than
  // failing the approval. The unique index is what makes this safe.
  for (let attempt = 0; attempt < 5; attempt++) {
    // Array form, not .single(): a no-op (another admin already handled it)
    // matches zero rows, which .single() treats as an error rather than the
    // harmless race it actually is.
    const { data, error } = await adminClient()
      .from("registrations")
      .update({
        status: "approved",
        ticket_code: generateTicketCode(),
        reject_reason: null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
      })
      .eq("id", id)
      .eq("status", "pending") // no-op if another admin already handled it
      .select("email, full_name");

    if (!error) {
      revalidatePath("/admin/review");
      // Only send the confirmation when this call actually approved the
      // row — a no-op race must not fire a second email.
      const approved = data?.[0];
      if (approved) {
        after(() =>
          sendTicketApprovedEmail({
            to: approved.email,
            fullName: approved.full_name,
            ticketId: id,
          }),
        );
      }
      return { ok: true };
    }
    if (error.code !== UNIQUE_VIOLATION) {
      console.error("approve failed", error);
      return { ok: false, error: "Could not approve. Try again." };
    }
  }

  return { ok: false, error: "Could not generate a ticket code. Try again." };
}

export async function rejectRegistration(
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
    .eq("status", "pending");

  if (error) {
    console.error("reject failed", error);
    return { ok: false, error: "Could not reject. Try again." };
  }

  revalidatePath("/admin/review");
  return { ok: true };
}
