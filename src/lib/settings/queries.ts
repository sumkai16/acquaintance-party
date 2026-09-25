import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { readOpenFlag } from "./open";

const PAYMENTS_OPEN_KEY = "payments_open";

/**
 * Whether the online GCash payment line is open right now.
 *
 * Fail-closed twice over: a missing row reads as closed (readOpenFlag), and
 * any read failure logs and returns closed rather than open — a payment gate
 * that cannot confirm its own state must not accept money. The walk-in flow
 * never consults this; it is admin-staffed cash in hand, not a public form.
 */
export async function paymentsOpen(): Promise<boolean> {
  try {
    const { data, error } = await adminClient()
      .from("settings")
      .select("value")
      .eq("key", PAYMENTS_OPEN_KEY)
      .maybeSingle();
    if (error) throw error;
    return readOpenFlag(data?.value ?? null);
  } catch (error) {
    console.error("paymentsOpen failed", error);
    return false;
  }
}

/**
 * Flips the payment line from the Dashboard toggle. Returns false on a
 * failed write (missing settings table — migration 0021 not pasted yet —
 * or a transient database error) so the caller can surface it instead of
 * logging an activity row for a change that never happened.
 */
export async function setPaymentsOpen(open: boolean): Promise<boolean> {
  const { error } = await adminClient().from("settings").upsert({
    key: PAYMENTS_OPEN_KEY,
    value: open ? "true" : "false",
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("setPaymentsOpen failed", error);
    return false;
  }
  return true;
}
