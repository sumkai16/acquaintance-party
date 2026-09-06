import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { ActivityLog } from "@/lib/supabase/types";
import type { ActivityType } from "./types";

type LogEntry = {
  userId: string | null;
  activityType: ActivityType;
  description: string;
  registrationId?: string;
  remittanceId?: string;
  amount?: number;
};

/**
 * Writes one immutable audit row. Never throws — a logging failure must not
 * fail the payment/remittance/login it's describing, so this swallows its
 * own error after reporting it. Called with `await`, not `after()`: unlike
 * the Sheets sync, losing an audit row for money is not an accepted cost.
 */
export async function logActivity(entry: LogEntry): Promise<void> {
  const { error } = await adminClient().from("activity_logs").insert({
    user_id: entry.userId,
    activity_type: entry.activityType,
    description: entry.description,
    registration_id: entry.registrationId ?? null,
    remittance_id: entry.remittanceId ?? null,
    amount: entry.amount ?? null,
  });

  if (error) console.error("logActivity failed", entry.activityType, error);
}

export type ActivityFilters = {
  userId?: string;
  activityType?: ActivityType;
  fromIso?: string;
  toIso?: string;
  registrationId?: string;
  query?: string;
};

export const ACTIVITY_PAGE_SIZE = 25;

export type ActivityPage = { logs: ActivityLog[]; total: number };

/**
 * One page of the log, newest first, plus the total matching-row count a
 * pagination control needs — a flat `.limit(200)` was dumping the whole
 * log onto one page regardless of how much history had built up.
 */
export async function listActivity(
  filters: ActivityFilters,
  page = 1,
): Promise<ActivityPage> {
  let builder = adminClient().from("activity_logs").select("*", { count: "exact" });

  if (filters.userId) builder = builder.eq("user_id", filters.userId);
  if (filters.activityType) builder = builder.eq("activity_type", filters.activityType);
  if (filters.fromIso) builder = builder.gte("created_at", filters.fromIso);
  if (filters.toIso) builder = builder.lt("created_at", filters.toIso);
  if (filters.registrationId) builder = builder.eq("registration_id", filters.registrationId);
  if (filters.query) {
    const safe = filters.query.trim().replace(/[%_,()\\]/g, "");
    if (safe.length >= 2) builder = builder.ilike("description", `%${safe}%`);
  }

  const offset = (Math.max(1, page) - 1) * ACTIVITY_PAGE_SIZE;
  const { data, count } = await builder
    .order("created_at", { ascending: false })
    .range(offset, offset + ACTIVITY_PAGE_SIZE - 1);

  return { logs: (data as ActivityLog[]) ?? [], total: count ?? 0 };
}
