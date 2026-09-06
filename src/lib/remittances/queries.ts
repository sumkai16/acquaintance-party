import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { CashRemittance } from "@/lib/supabase/types";
import { staffCashSummary } from "@/lib/cash/queries";

export type CreateRemittanceResult =
  | { ok: true; id: string }
  | { ok: false; error: "exceeds_available" | "failed" };

/**
 * Re-derives availableToRemit at submit time and rejects anything over it.
 * This is a recheck, not a lock — two rapid double-clicks could in
 * principle both read the same available balance before either write
 * lands. Accepted for a handful of staff at a single school event; see the
 * plan's Design decisions.
 */
export async function createRemittance(
  staffId: string,
  amountCentavos: number,
): Promise<CreateRemittanceResult> {
  const summary = await staffCashSummary(staffId);
  if (amountCentavos > summary.availableToRemitCentavos) {
    return { ok: false, error: "exceeds_available" };
  }

  const { data, error } = await adminClient()
    .from("cash_remittances")
    .insert({ staff_id: staffId, amount: amountCentavos })
    .select("id")
    .single();

  if (error) {
    console.error("createRemittance failed", error);
    return { ok: false, error: "failed" };
  }
  return { ok: true, id: data.id };
}

export async function listStaffRemittances(staffId: string): Promise<CashRemittance[]> {
  const { data } = await adminClient()
    .from("cash_remittances")
    .select("*")
    .eq("staff_id", staffId)
    .order("submitted_at", { ascending: false });
  return (data as CashRemittance[]) ?? [];
}

export async function listAllRemittances(): Promise<
  (CashRemittance & { staffName: string })[]
> {
  const [{ data: remittances }, { data: staff }] = await Promise.all([
    adminClient().from("cash_remittances").select("*").order("submitted_at", { ascending: false }),
    adminClient().from("profiles").select("id, full_name"),
  ]);

  const names = new Map((staff ?? []).map((row) => [row.id, row.full_name as string]));
  return ((remittances as CashRemittance[]) ?? []).map((row) => ({
    ...row,
    staffName: names.get(row.staff_id) ?? "Unknown",
  }));
}

export type ApproveResult = { ok: true } | { ok: false; error: "already_resolved" | "failed" };

/**
 * The `.eq("status", "pending")` in the WHERE clause is the whole guard
 * against approving (or rejecting) a remittance twice — Postgres commits
 * this as one atomic statement, so two concurrent approve calls can't both
 * match the same still-pending row. A `maybeSingle()` with no matching row
 * is how a lost race is told apart from a real failure.
 */
export async function approveRemittance(id: string, adminId: string): Promise<ApproveResult> {
  const { data, error } = await adminClient()
    .from("cash_remittances")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: adminId })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("approveRemittance failed", error);
    return { ok: false, error: "failed" };
  }
  if (!data) return { ok: false, error: "already_resolved" };
  return { ok: true };
}

export async function rejectRemittance(
  id: string,
  reason: string,
): Promise<ApproveResult> {
  const { data, error } = await adminClient()
    .from("cash_remittances")
    .update({ status: "rejected", rejection_reason: reason })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("rejectRemittance failed", error);
    return { ok: false, error: "failed" };
  }
  if (!data) return { ok: false, error: "already_resolved" };
  return { ok: true };
}
