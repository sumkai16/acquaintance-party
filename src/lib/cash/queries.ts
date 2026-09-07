import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { availableToRemitCentavos, currentCollectionCentavos } from "./balances";
import { startOfTodayPH } from "@/lib/format/datetime";

/**
 * Sum of a staff member's own walk-in sales. Filtered to status='approved'
 * deliberately: if an admin later Voids one of this staff's walk-in tickets
 * (registrations.status -> 'rejected'), that cash should no longer count as
 * theirs to remit — Void already exists as a feature; this just makes cash
 * accounting agree with it instead of silently drifting.
 */
async function staffWalkInCollectedCentavos(staffId: string): Promise<number> {
  const { data } = await adminClient()
    .from("registrations")
    .select("amount")
    .eq("payment_method", "walk_in")
    .eq("reviewed_by", staffId)
    .eq("status", "approved");
  return (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
}

async function staffRemittedCentavos(
  staffId: string,
  status: "pending" | "approved",
): Promise<number> {
  const { data } = await adminClient()
    .from("cash_remittances")
    .select("amount")
    .eq("staff_id", staffId)
    .eq("status", status);
  return (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
}

export type StaffCashSummary = {
  collectedCentavos: number;
  currentCollectionCentavos: number;
  pendingRemittanceCentavos: number;
  availableToRemitCentavos: number;
  todayCollectionCentavos: number;
  transactionCount: number;
};

export async function staffCashSummary(staffId: string): Promise<StaffCashSummary> {
  const [collected, approvedRemitted, pendingRemitted, todayRows, countResult] =
    await Promise.all([
      staffWalkInCollectedCentavos(staffId),
      staffRemittedCentavos(staffId, "approved"),
      staffRemittedCentavos(staffId, "pending"),
      adminClient()
        .from("registrations")
        .select("amount")
        .eq("payment_method", "walk_in")
        .eq("reviewed_by", staffId)
        .eq("status", "approved")
        .gte("created_at", startOfTodayPH()),
      adminClient()
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("payment_method", "walk_in")
        .eq("reviewed_by", staffId)
        .eq("status", "approved"),
    ]);

  const current = currentCollectionCentavos(collected, approvedRemitted);
  return {
    collectedCentavos: collected,
    currentCollectionCentavos: current,
    pendingRemittanceCentavos: pendingRemitted,
    availableToRemitCentavos: availableToRemitCentavos(current, pendingRemitted),
    todayCollectionCentavos: (todayRows.data ?? []).reduce(
      (sum, row) => sum + (row.amount as number),
      0,
    ),
    transactionCount: countResult.count ?? 0,
  };
}

/** Admin's own direct walk-in sales, plus every approved remittance received from staff. */
export async function adminCurrentCollectionCentavos(): Promise<number> {
  const [{ data: admins }, { data: remittances }] = await Promise.all([
    adminClient().from("profiles").select("id").eq("role", "admin"),
    adminClient().from("cash_remittances").select("amount").eq("status", "approved"),
  ]);

  const adminIds = (admins ?? []).map((row) => row.id);
  let ownSales = 0;
  if (adminIds.length > 0) {
    const { data } = await adminClient()
      .from("registrations")
      .select("amount")
      .eq("payment_method", "walk_in")
      .eq("status", "approved")
      .in("reviewed_by", adminIds);
    ownSales = (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
  }

  const remitted = (remittances ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
  return ownSales + remitted;
}

/** Sum, across every staff member, of cash collected but not yet approved-remitted. */
export async function staffCashOnHandCentavos(): Promise<number> {
  const { data: staff } = await adminClient().from("profiles").select("id").eq("role", "staff");
  const staffIds = (staff ?? []).map((row) => row.id);
  if (staffIds.length === 0) return 0;

  const [{ data: sales }, { data: remittances }] = await Promise.all([
    adminClient()
      .from("registrations")
      .select("amount")
      .eq("payment_method", "walk_in")
      .eq("status", "approved")
      .in("reviewed_by", staffIds),
    adminClient().from("cash_remittances").select("amount").eq("status", "approved"),
  ]);

  const collected = (sales ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
  const remitted = (remittances ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
  return currentCollectionCentavos(collected, remitted);
}

/**
 * Every approved walk-in sale, admin's and staff's alike — the cash side of
 * the event only. Deliberately not totalCollectedCentavos(), which also
 * counts GCash: nobody is *holding* a GCash payment, so mixing it in leaves
 * a total that the two "who has it" cards below can never add up to. In
 * normal operation this equals adminCurrentCollection + staffCashOnHand.
 * The all-payment-methods total is still the right figure on the Attendance
 * dashboard and Find a registration; it just isn't a cash figure.
 */
export async function totalCashCollectedCentavos(): Promise<number> {
  const { data } = await adminClient()
    .from("registrations")
    .select("amount")
    .eq("payment_method", "walk_in")
    .eq("status", "approved");
  return (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
}

/** How many approved walk-in sales that total is made of. */
export async function cashPaymentCount(): Promise<number> {
  const { count } = await adminClient()
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("payment_method", "walk_in")
    .eq("status", "approved");
  return count ?? 0;
}

export async function pendingRemittancesCentavos(): Promise<number> {
  const { data } = await adminClient()
    .from("cash_remittances")
    .select("amount")
    .eq("status", "pending");
  return (data ?? []).reduce((sum, row) => sum + (row.amount as number), 0);
}
