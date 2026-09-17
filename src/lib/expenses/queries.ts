import "server-only";
import { randomUUID } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { listAllProfileNames } from "@/lib/profiles/queries";
import type { Expense, ExpenseMethod } from "@/lib/supabase/types";

export type CreateExpenseInput = {
  itemName: string;
  amountCentavos: number;
  method: ExpenseMethod;
  spentAtIso: string;
  addedBy: string;
  receiptPath?: string | null;
};

export async function createExpense(
  input: CreateExpenseInput,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const { data, error } = await adminClient()
    .from("expenses")
    .insert({
      item_name: input.itemName,
      amount: input.amountCentavos,
      method: input.method,
      spent_at: input.spentAtIso,
      added_by: input.addedBy,
      receipt_path: input.receiptPath ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("createExpense failed", error);
    return { ok: false };
  }
  return { ok: true, id: data.id };
}

const RECEIPTS_BUCKET = "receipts";

/**
 * Stored under `expenses/` in the same private bucket checkout uses — its
 * own keys are `<year>/<uuid>.<ext>`, so the prefixes can't collide.
 */
export async function uploadExpenseReceipt(
  file: File,
): Promise<{ ok: true; path: string } | { ok: false }> {
  const extension = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `expenses/${randomUUID()}.${extension}`;
  const { error } = await adminClient()
    .storage.from(RECEIPTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("uploadExpenseReceipt failed", error);
    return { ok: false };
  }
  return { ok: true, path };
}

export async function removeExpenseReceipt(path: string): Promise<void> {
  await adminClient().storage.from(RECEIPTS_BUCKET).remove([path]);
}

/** A 10-minute signed URL for an expense's receipt, or null if it has none. */
export async function signedExpenseReceiptUrl(expenseId: string): Promise<string | null> {
  const { data: row } = await adminClient()
    .from("expenses")
    .select("receipt_path")
    .eq("id", expenseId)
    .maybeSingle();
  if (!row?.receipt_path) return null;

  const { data } = await adminClient()
    .storage.from(RECEIPTS_BUCKET)
    .createSignedUrl(row.receipt_path, 600);
  return data?.signedUrl ?? null;
}

export type ExpenseWithNames = Expense & {
  addedByName: string;
  voidedByName: string | null;
};

/**
 * Every expense, newest spent_at first, with names resolved for display.
 * Throws on a failed read rather than returning [] — an empty list would
 * look like a real "no expenses" page or export, and inflate every balance.
 */
export async function listExpenses(): Promise<ExpenseWithNames[]> {
  const [{ data, error }, names] = await Promise.all([
    adminClient().from("expenses").select("*").order("spent_at", { ascending: false }),
    listAllProfileNames(),
  ]);
  if (error) throw new Error(`listExpenses failed: ${error.message}`);

  return ((data as Expense[]) ?? []).map((row) => ({
    ...row,
    addedByName: names.get(row.added_by) ?? "Unknown",
    voidedByName: row.voided_by ? (names.get(row.voided_by) ?? "Unknown") : null,
  }));
}

export type SpentTotals = { cashCentavos: number; gcashCentavos: number };

/** Sum of every non-voided expense, split by method. Throws on a failed read, same reason as listExpenses. */
export async function spentCentavos(): Promise<SpentTotals> {
  const { data, error } = await adminClient()
    .from("expenses")
    .select("amount, method")
    .is("voided_at", null);
  if (error) throw new Error(`spentCentavos failed: ${error.message}`);

  const rows = data ?? [];
  return {
    cashCentavos: rows
      .filter((row) => row.method === "cash")
      .reduce((sum, row) => sum + (row.amount as number), 0),
    gcashCentavos: rows
      .filter((row) => row.method === "gcash")
      .reduce((sum, row) => sum + (row.amount as number), 0),
  };
}

export type VoidResult = { ok: true } | { ok: false; error: "already_voided" | "failed" };

/**
 * The `.is("voided_at", null)` in the WHERE clause is the whole guard
 * against voiding an expense twice — same atomic-UPDATE pattern as
 * approveRemittance() in src/lib/remittances/queries.ts.
 */
export async function voidExpense(
  id: string,
  adminId: string,
  reason: string,
): Promise<VoidResult> {
  const { data, error } = await adminClient()
    .from("expenses")
    .update({ voided_at: new Date().toISOString(), voided_by: adminId, void_reason: reason })
    .eq("id", id)
    .is("voided_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("voidExpense failed", error);
    return { ok: false, error: "failed" };
  }
  if (!data) return { ok: false, error: "already_voided" };
  return { ok: true };
}
