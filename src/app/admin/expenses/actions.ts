"use server";

import { revalidatePath } from "next/cache";
import { currentProfile } from "@/lib/supabase/server";
import { formatPeso } from "@/lib/config/event";
import { logActivity } from "@/lib/activity/queries";
import {
  createExpense,
  removeExpenseReceipt,
  spentCentavos,
  uploadExpenseReceipt,
  voidExpense,
  type CreateExpenseInput,
} from "@/lib/expenses/queries";
import { totalCashCollectedCentavos } from "@/lib/cash/queries";
import { onlinePaymentsSummary } from "@/lib/registrations/queries";
import { manilaLocalToIso, parsePesoToCentavos } from "@/lib/expenses/parse";
import type { ExpenseMethod } from "@/lib/supabase/types";

export type AddExpenseResult =
  | { ok: true }
  | { ok: false; error: string; needsConfirm?: boolean };

async function requireAdmin() {
  const profile = await currentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}

/**
 * Re-derives the balance for `method` at submit time and returns how far
 * over it this expense would go (0 or negative means it's within budget).
 * Used both to warn in the UI and to require an explicit confirm on the
 * server — a client-side check alone could be bypassed or stale.
 */
async function overspendCentavos(method: ExpenseMethod, amountCentavos: number): Promise<number> {
  const [cashCollected, gcashCollected, spent] = await Promise.all([
    totalCashCollectedCentavos(),
    onlinePaymentsSummary(),
    spentCentavos(),
  ]);
  const collected = method === "cash" ? cashCollected : gcashCollected.totalCentavos;
  const alreadySpent = method === "cash" ? spent.cashCentavos : spent.gcashCentavos;
  const remaining = collected - alreadySpent;
  return amountCentavos - remaining;
}

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Fields: itemName, amount, method, spentAt (datetime-local value),
 * confirmed ("true" once the admin accepted an overspend warning), and an
 * optional `receipt` image.
 */
export async function addExpense(formData: FormData): Promise<AddExpenseResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admins only." };

  const trimmedName = String(formData.get("itemName") ?? "").trim();
  if (trimmedName.length < 2 || trimmedName.length > 120) {
    return { ok: false, error: "Item name must be 2–120 characters." };
  }
  const method = String(formData.get("method") ?? "") as ExpenseMethod;
  if (method !== "cash" && method !== "gcash") {
    return { ok: false, error: "Choose a payment method." };
  }

  const amountCentavos = parsePesoToCentavos(String(formData.get("amount") ?? ""));
  if (amountCentavos === null) {
    return { ok: false, error: "Enter a valid amount." };
  }

  const spentAtIso = manilaLocalToIso(String(formData.get("spentAt") ?? ""));
  if (spentAtIso === null) {
    return { ok: false, error: "Enter a valid date and time — it can't be in the future." };
  }

  const receipt = formData.get("receipt");
  const hasReceipt = receipt instanceof File && receipt.size > 0;
  if (hasReceipt) {
    if (receipt.size > MAX_RECEIPT_BYTES) {
      return { ok: false, error: "Keep the receipt photo under 5 MB." };
    }
    if (!ALLOWED_RECEIPT_TYPES.includes(receipt.type)) {
      return { ok: false, error: "Receipt must be a JPG, PNG, or WebP image." };
    }
  }

  // Before the upload, so a request that stops to ask for confirmation
  // never leaves a stored photo behind.
  const over = await overspendCentavos(method, amountCentavos);
  if (over > 0 && formData.get("confirmed") !== "true") {
    return {
      ok: false,
      error: `This would put ${method === "cash" ? "Total Cash" : "Total GCash"} ${formatPeso(over)} into the negative. Save anyway?`,
      needsConfirm: true,
    };
  }

  let receiptPath: string | null = null;
  if (hasReceipt) {
    const upload = await uploadExpenseReceipt(receipt);
    if (!upload.ok) return { ok: false, error: "Could not save the receipt photo. Try again." };
    receiptPath = upload.path;
  }

  const input: CreateExpenseInput = {
    itemName: trimmedName,
    amountCentavos,
    method,
    spentAtIso,
    addedBy: admin.id,
    receiptPath,
  };
  const result = await createExpense(input);
  if (!result.ok) {
    if (receiptPath) await removeExpenseReceipt(receiptPath);
    return { ok: false, error: "Something went wrong. Try again." };
  }

  await logActivity({
    userId: admin.id,
    activityType: "expense_added",
    description: `${admin.fullName} added expense "${trimmedName}" ${formatPeso(amountCentavos)} (${method === "cash" ? "Cash" : "GCash"})${receiptPath ? " with receipt" : ""}`,
    amount: amountCentavos,
  });

  revalidatePath("/admin/expenses");
  return { ok: true };
}

export type ActionResult = { ok: boolean; error?: string };

export async function voidExpenseAction(id: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Admins only." };

  const trimmedReason = reason.trim();
  if (!trimmedReason) return { ok: false, error: "Give a reason." };
  if (trimmedReason.length > 300) return { ok: false, error: "Keep the reason under 300 characters." };

  const result = await voidExpense(id, admin.id, trimmedReason);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "already_voided"
          ? "This expense was already voided."
          : "Something went wrong. Try again.",
    };
  }

  await logActivity({
    userId: admin.id,
    activityType: "expense_voided",
    description: `${admin.fullName} voided an expense: ${trimmedReason}`,
  });

  revalidatePath("/admin/expenses");
  return { ok: true };
}
