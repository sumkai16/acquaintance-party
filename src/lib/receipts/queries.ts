import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity/queries";
import type { RegistrationStatus } from "@/lib/supabase/types";
import type { ReceiptMethod } from "./format";
import { backlogGroup, sortByPriority, type BacklogGroup } from "./priority";

export type Receipt = {
  id: string;
  number: number;
  registrationId: string | null;
  fullName: string;
  studentId: string;
  yearLevel: string;
  section: string;
  amount: number;
  method: ReceiptMethod;
  balanceAfter: number;
  receivedByName: string | null;
  paidAt: Date;
  ticketCode: string | null;
  registrationStatus: RegistrationStatus | null;
};

/**
 * Records one payment. Never throws and never blocks the sale it describes —
 * the money was already taken; a missing receipt is fixable, a failed sale
 * with cash in hand is not. Callers log the null.
 */
export async function issueReceipt(input: {
  registrationId: string;
  amount: number;
  method: ReceiptMethod;
  balanceAfter: number;
  receivedBy: string | null;
  paidAt: string;
}): Promise<{ id: string } | null> {
  const { data: registration } = await adminClient()
    .from("registrations")
    .select("full_name, student_id, year_level, section")
    .eq("id", input.registrationId)
    .maybeSingle();

  if (!registration) {
    console.error("issueReceipt: registration not found", input.registrationId);
    return null;
  }

  const { data, error } = await adminClient()
    .from("receipts")
    .insert({
      registration_id: input.registrationId,
      full_name: registration.full_name,
      student_id: registration.student_id,
      year_level: registration.year_level,
      section: registration.section,
      amount: input.amount,
      method: input.method,
      balance_after: input.balanceAfter,
      received_by: input.receivedBy,
      paid_at: input.paidAt,
    })
    .select("id")
    .single();

  if (error) {
    console.error("issueReceipt failed", error);
    return null;
  }
  return { id: data.id };
}

/**
 * issueReceipt, plus an activity row when it fails — so a missing receipt
 * shows up on /admin/activity instead of only in a server log nobody reads.
 * Returns the ids to put in the payment's email (empty on failure).
 */
export async function issueReceiptOrLog(
  input: Parameters<typeof issueReceipt>[0] & { fullName: string },
): Promise<string[]> {
  const { fullName, ...receipt } = input;
  const issued = await issueReceipt(receipt);
  if (issued) return [issued.id];

  await logActivity({
    userId: input.receivedBy,
    activityType: "receipt_failed",
    description: `Couldn't issue a receipt for ${fullName}'s payment`,
    registrationId: input.registrationId,
    amount: input.amount,
  });
  return [];
}

export async function getReceipt(id: string): Promise<Receipt | null> {
  const { data } = await adminClient()
    .from("receipts")
    .select("*, registrations(ticket_code, status)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  let receivedByName: string | null = null;
  if (data.received_by) {
    const { data: profile } = await adminClient()
      .from("profiles")
      .select("full_name")
      .eq("id", data.received_by)
      .maybeSingle();
    receivedByName = profile?.full_name ?? null;
  }

  const registration = data.registrations as
    | { ticket_code: string | null; status: RegistrationStatus }
    | null;

  return {
    id: data.id,
    number: data.number,
    registrationId: data.registration_id,
    fullName: data.full_name,
    studentId: data.student_id,
    yearLevel: data.year_level,
    section: data.section,
    amount: data.amount,
    method: data.method,
    balanceAfter: data.balance_after,
    receivedByName,
    paidAt: new Date(data.paid_at),
    ticketCode: registration?.ticket_code ?? null,
    registrationStatus: registration?.status ?? null,
  };
}

/** Receipt ids for one registration that haven't been emailed yet, oldest first. */
export async function unemailedReceiptIds(registrationId: string): Promise<string[]> {
  const { data } = await adminClient()
    .from("receipts")
    .select("id")
    .eq("registration_id", registrationId)
    .is("emailed_at", null)
    .order("number", { ascending: true });
  return (data ?? []).map((row) => row.id as string);
}

/** All receipt ids for one registration, oldest first — for a manual resend. */
export async function receiptIdsFor(registrationId: string): Promise<string[]> {
  const { data } = await adminClient()
    .from("receipts")
    .select("id")
    .eq("registration_id", registrationId)
    .order("number", { ascending: true });
  return (data ?? []).map((row) => row.id as string);
}

export type RowReceipt = { id: string; emailed: boolean };

/**
 * Receipts per registration for a page of rows — one query, not one per
 * row, the same batching `signedReceiptUrls` does for the Dashboard. Carries
 * whether each was emailed, for the row's "Receipt sent" marker.
 */
export async function receiptsForMany(
  registrationIds: string[],
): Promise<Map<string, RowReceipt[]>> {
  const byRegistration = new Map<string, RowReceipt[]>();
  if (registrationIds.length === 0) return byRegistration;

  const { data } = await adminClient()
    .from("receipts")
    .select("id, registration_id, emailed_at")
    .in("registration_id", registrationIds)
    .order("number", { ascending: true });

  for (const row of data ?? []) {
    const key = row.registration_id as string;
    byRegistration.set(key, [
      ...(byRegistration.get(key) ?? []),
      { id: row.id as string, emailed: Boolean(row.emailed_at) },
    ]);
  }
  return byRegistration;
}

export type ReceiptBacklogEntry = {
  registrationId: string;
  email: string;
  fullName: string;
  /** Set only when the ticket is approved — a partial payer gets no QR yet. */
  ticketCode: string | null;
  receiptIds: string[];
  group: BacklogGroup;
};

/**
 * Paid students with at least one receipt nobody has emailed them, most
 * urgent first (see ./priority.ts): anyone still without their QR, then
 * partial payers, then people who only lack the receipt. Within each group,
 * oldest payment first. Voided tickets are left out: an apology email for a
 * ticket we cancelled would only confuse. Null means the table couldn't be
 * read (migration 0014 not pasted yet), which must not read as "nobody left".
 */
export async function receiptBacklog(): Promise<ReceiptBacklogEntry[] | null> {
  const { data, error } = await adminClient()
    .from("receipts")
    .select(
      "id, registration_id, registrations(email, full_name, status, ticket_code, ticket_email_sent_at)",
    )
    .is("emailed_at", null)
    .not("registration_id", "is", null)
    .order("number", { ascending: true })
    .range(0, 9999);

  if (error) {
    console.error("receiptBacklog failed", error);
    return null;
  }

  const byRegistration = new Map<string, ReceiptBacklogEntry>();
  for (const row of data ?? []) {
    const registration = row.registrations as unknown as {
      email: string;
      full_name: string;
      status: RegistrationStatus;
      ticket_code: string | null;
      ticket_email_sent_at: string | null;
    } | null;
    if (!registration || registration.status === "rejected") continue;

    const registrationId = row.registration_id as string;
    const entry = byRegistration.get(registrationId) ?? {
      registrationId,
      email: registration.email,
      fullName: registration.full_name,
      ticketCode: registration.status === "approved" ? registration.ticket_code : null,
      receiptIds: [],
      group: backlogGroup(registration),
    };
    entry.receiptIds.push(row.id as string);
    byRegistration.set(registrationId, entry);
  }
  return sortByPriority([...byRegistration.values()]);
}

/** Stamped only after Resend accepts the send — never before. */
export async function markReceiptsEmailed(receiptIds: string[]): Promise<void> {
  if (receiptIds.length === 0) return;
  const { error } = await adminClient()
    .from("receipts")
    .update({ emailed_at: new Date().toISOString() })
    .in("id", receiptIds);
  if (error) console.error("markReceiptsEmailed failed", error);
}

/**
 * Puts every receipt for a registration back in the backlog after Resend
 * reports the email that carried them bounced — see
 * clearTicketEmailSent's comment for why "accepted" and "delivered" get
 * treated differently here. Whole registration, not one receipt: a single
 * email carries every unemailed receipt a registration has, so a bounce
 * means none of them arrived.
 */
export async function clearReceiptsEmailedFor(registrationId: string): Promise<void> {
  const { error } = await adminClient()
    .from("receipts")
    .update({ emailed_at: null })
    .eq("registration_id", registrationId)
    .not("emailed_at", "is", null);
  if (error) console.error("clearReceiptsEmailedFor failed", error);
}
