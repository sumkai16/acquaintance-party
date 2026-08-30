"use server";

import { revalidatePath } from "next/cache";
import { generateTicketCode } from "@/lib/tickets/code";
import { adminClient } from "@/lib/supabase/admin";
import { serverClient } from "@/lib/supabase/server";

const UNIQUE_VIOLATION = "23505";

export type ActionResult = { ok: boolean; error?: string };

async function currentAdminId(): Promise<string | null> {
  const { data } = await (await serverClient()).auth.getUser();
  return data.user?.id ?? null;
}

export async function approveRegistration(id: string): Promise<ActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  // Retry on the vanishingly unlikely ticket-code collision rather than
  // failing the approval. The unique index is what makes this safe.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await adminClient()
      .from("registrations")
      .update({
        status: "approved",
        ticket_code: generateTicketCode(),
        reject_reason: null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
      })
      .eq("id", id)
      .eq("status", "pending"); // no-op if another admin already handled it

    if (!error) {
      revalidatePath("/admin/review");
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
