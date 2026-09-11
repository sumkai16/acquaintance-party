import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { generateTicketCode } from "@/lib/tickets/generate";
import type { PaymentMethod, Registration, RegistrationStatus } from "@/lib/supabase/types";
import type { CheckoutInput, WalkInInput } from "./schema";
import { REGISTRATION_SORT_COLUMNS, type RegistrationSortColumn } from "./sort";

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";

/**
 * A 23505 doesn't say which constraint fired, but the Postgres error message
 * names it — used to tell "this GCash reference is already used" apart from
 * "this student already has an active registration" instead of always
 * assuming the former.
 */
function isStudentIdViolation(message: string): boolean {
  return message.includes("registrations_student_id_active_key");
}

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: "duplicate_reference" | "duplicate_student_id" | "failed" };

export async function createRegistration(
  input: CheckoutInput & { receiptPath: string; amount: number },
): Promise<CreateResult> {
  const { data, error } = await adminClient()
    .from("registrations")
    .insert({
      full_name: input.fullName,
      student_id: input.studentId,
      year_level: input.yearLevel,
      section: input.section,
      email: input.email,
      payment_method: "online",
      gcash_reference: input.gcashReference,
      receipt_path: input.receiptPath,
      amount: input.amount,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        ok: false,
        error: isStudentIdViolation(error.message)
          ? "duplicate_student_id"
          : "duplicate_reference",
      };
    }
    console.error("createRegistration failed", error);
    return { ok: false, error: "failed" };
  }

  return { ok: true, id: data.id };
}

export type UpdateIdentityResult =
  | { ok: true }
  | { ok: false; error: "duplicate_student_id" | "failed" };

/**
 * Corrects the identity fields on an existing registration — the fix for a
 * staff typo, which until now could only be done by hand in the Supabase
 * table editor, with no validation and no trace.
 *
 * Identity only. `amount`, `status`, `ticket_code` and `gcash_reference` are
 * deliberately not writable here: each already has a flow that keeps the
 * money and the door in step (approve, reject, void), and a quiet edit to
 * any of them is how a cash box stops reconciling with the dashboard.
 *
 * A corrected student_id can still collide with a row that already holds it,
 * which is the same partial unique index that guards checkout — reported
 * back rather than swallowed, because the admin needs to know they're
 * looking at two registrations for one student.
 */
export async function updateRegistrationIdentity(
  id: string,
  input: WalkInInput,
): Promise<UpdateIdentityResult> {
  const { error } = await adminClient()
    .from("registrations")
    .update({
      full_name: input.fullName,
      student_id: input.studentId,
      year_level: input.yearLevel,
      section: input.section,
      email: input.email,
    })
    .eq("id", id);

  if (error) {
    if (error.code === UNIQUE_VIOLATION && isStudentIdViolation(error.message)) {
      return { ok: false, error: "duplicate_student_id" };
    }
    console.error("updateRegistrationIdentity failed", error);
    return { ok: false, error: "failed" };
  }

  return { ok: true };
}

export type CreateWalkInResult =
  // The code comes back out because the confirmation email draws the QR from
  // it — a walk-in is approved on the spot, so this is the only moment it is
  // in hand without a second read.
  | { ok: true; id: string; ticketCode: string }
  | { ok: false; error: "duplicate_student_id" | "failed" };

/**
 * A cash sale entered directly by an admin — approved immediately, since
 * staff already has the cash in hand and there's no receipt to review.
 * Retries on a ticket-code collision the same way approveRegistration does
 * in admin/review/actions.ts.
 */
export async function createWalkInRegistration(
  input: WalkInInput & { amount: number; reviewedBy: string },
): Promise<CreateWalkInResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await adminClient()
      .from("registrations")
      .insert({
        full_name: input.fullName,
        student_id: input.studentId,
        year_level: input.yearLevel,
        section: input.section,
        email: input.email,
        payment_method: "walk_in",
        gcash_reference: null,
        receipt_path: null,
        amount: input.amount,
        status: "approved",
        ticket_code: generateTicketCode(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: input.reviewedBy,
      })
      .select("id, ticket_code")
      .single();

    if (!error) return { ok: true, id: data.id, ticketCode: data.ticket_code };

    if (error.code === UNIQUE_VIOLATION) {
      if (isStudentIdViolation(error.message)) {
        return { ok: false, error: "duplicate_student_id" };
      }
      continue; // ticket-code collision — try again
    }
    console.error("createWalkInRegistration failed", error);
    return { ok: false, error: "failed" };
  }

  return { ok: false, error: "failed" };
}

/**
 * Which of these student IDs already have an active (non-rejected)
 * registration — one batched check backing the bulk walk-in import's
 * duplicate-in-database flag, instead of one lookup per row.
 */
export async function findActiveStudentIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();

  const { data } = await adminClient()
    .from("registrations")
    .select("student_id")
    .in("student_id", ids)
    .neq("status", "rejected");

  return new Set((data ?? []).map((row) => row.student_id as string));
}

export async function getRegistration(id: string): Promise<Registration | null> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return (data as Registration) ?? null;
}

export async function listPending(): Promise<Registration[]> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (data as Registration[]) ?? [];
}

/** Every registration sharing a GCash reference. Used to flag reused receipts. */
export async function findByReference(
  reference: string,
): Promise<Registration[]> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("gcash_reference", reference)
    .order("created_at", { ascending: true });

  return (data as Registration[]) ?? [];
}

/** How many times this email has submitted since `sinceIso`. */
export async function countRecentByEmail(
  email: string,
  sinceIso: string,
): Promise<number> {
  const { count } = await adminClient()
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", sinceIso);

  return count ?? 0;
}

/**
 * Rows per page on the Dashboard.
 *
 * Much smaller than the Activity log's 25 because the rows aren't
 * comparable: a registration row is four lines tall — name, year and
 * section, email, student ID — where a log row is one. Ten of these is
 * roughly a screen, which is the point; twenty would have left the table
 * running off the bottom exactly as before.
 *
 * Raise it here if browsing beats scrolling — it's the only place the
 * number appears.
 */
export const REGISTRATIONS_PAGE_SIZE = 10;

export type RegistrationsPage = { rows: Registration[]; total: number };

/**
 * Finds registrations by partial name or email, for a student at the door
 * who has lost their ticket link. One page at a time, with the total count
 * a pagination control needs — the old flat cap of 50 both hid rows past
 * the fiftieth and made the table taller than the screen once sales picked
 * up.
 *
 * `status` also lets this browse without a query at all — "all" (or a
 * specific status) with an empty query lists registrations directly,
 * covering what used to be a separate Rejections page. With neither a
 * query nor a status, there is nothing to show yet.
 */
export async function searchRegistrations(
  query: string,
  status?: "all" | RegistrationStatus,
  paymentMethod?: "all" | PaymentMethod,
  options: {
    page?: number;
    sort?: RegistrationSortColumn | null;
    direction?: "asc" | "desc";
    /** One of YEAR_LEVELS, already validated by the caller. */
    yearLevel?: string;
  } = {},
): Promise<RegistrationsPage> {
  const trimmed = query.trim();
  // Escape PostgREST's pattern wildcards and its comma/parenthesis
  // separators so a search for "a,b" cannot break out of the filter.
  const safe = trimmed.replace(/[%_,()\\]/g, "");
  const hasQuery = safe.length >= 2;

  const { sort = null, direction = "desc", yearLevel } = options;

  if (!hasQuery && !status && !paymentMethod && !yearLevel) {
    return { rows: [], total: 0 };
  }

  let builder = adminClient().from("registrations").select("*", { count: "exact" });
  if (hasQuery) builder = builder.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  if (status && status !== "all") builder = builder.eq("status", status);
  if (paymentMethod && paymentMethod !== "all") builder = builder.eq("payment_method", paymentMethod);
  if (yearLevel) builder = builder.eq("year_level", yearLevel);

  // Ordering moved into the query once only one page comes back. Sorting the
  // fetched rows in JS would reorder only the rows on screen out of every
  // match — which looks right and is not.
  //
  // With no column picked, rejected rows read newest-rejected-first and
  // everything else newest-submitted-first, matching what the old dedicated
  // Rejections page did before it was folded into this search.
  if (sort) {
    builder = builder.order(REGISTRATION_SORT_COLUMNS[sort], {
      ascending: direction === "asc",
    });
  } else if (yearLevel) {
    // Narrowing to one year is how you read a year *by section* — which
    // sections have paid, who is missing from D. Newest-first scatters those
    // sections down the list, so a year filter brings its own default order:
    // A, B, C…, then by name inside each section. An explicit column click
    // still wins, which is why this sits in the else branch.
    builder = builder
      .order("section", { ascending: true })
      .order("full_name", { ascending: true });
  } else {
    builder = builder.order(status === "rejected" ? "reviewed_at" : "created_at", {
      ascending: false,
    });
  }

  const page = Math.max(1, options.page ?? 1);
  const offset = (page - 1) * REGISTRATIONS_PAGE_SIZE;
  const { data, count } = await builder.range(
    offset,
    offset + REGISTRATIONS_PAGE_SIZE - 1,
  );

  return { rows: (data as Registration[]) ?? [], total: count ?? 0 };
}

/**
 * Every registration, newest first — the whole table, for the backup export.
 *
 * Throws rather than returning an empty list on error, unlike the queries
 * that feed a screen. A page that renders no rows is obviously wrong to
 * whoever is looking at it; a *backup file* containing no rows looks exactly
 * like a successful download and is discovered to be empty on the one day it
 * is needed. Failing loudly is the whole point of this function.
 *
 * The explicit range is there for the same reason: PostgREST silently caps
 * an unbounded select at 1,000 rows, comfortably above the event's 700
 * capacity but not once rejected and resubmitted rows are counted too.
 */
export async function allRegistrations(): Promise<Registration[]> {
  const { data, error } = await adminClient()
    .from("registrations")
    .select("*")
    .order("created_at", { ascending: false })
    .range(0, 9999);

  if (error) throw new Error(`allRegistrations failed: ${error.message}`);
  return (data as Registration[]) ?? [];
}

/**
 * Every approved registration's year level, section, and amount — no row
 * limit, unlike searchRegistrations()'s capped 50, since this feeds a
 * full per-section report rather than a browsable list.
 */
export async function listApprovedForSectionReport(): Promise<
  Pick<Registration, "year_level" | "section" | "amount">[]
> {
  const { data } = await adminClient()
    .from("registrations")
    .select("year_level, section, amount")
    .eq("status", "approved");

  return (data as Pick<Registration, "year_level" | "section" | "amount">[]) ?? [];
}

export type PaymentMethodSummary = { count: number; totalCentavos: number };

async function paymentMethodSummary(method: PaymentMethod): Promise<PaymentMethodSummary> {
  const { data } = await adminClient()
    .from("registrations")
    .select("amount")
    .eq("payment_method", method)
    .eq("status", "approved");

  const rows = data ?? [];
  return {
    count: rows.length,
    totalCentavos: rows.reduce((sum, row) => sum + (row.amount as number), 0),
  };
}

/**
 * Approved online (GCash) payments only — how many students paid this way,
 * and how much that's worth. Walk-in cash sales are tracked separately on
 * the Cash page, since they're a different custody question (who's holding
 * the cash) rather than "how many people paid online."
 */
export async function onlinePaymentsSummary(): Promise<PaymentMethodSummary> {
  return paymentMethodSummary("online");
}

/** Approved walk-in (cash) payments only — the counterpart to onlinePaymentsSummary. */
export async function cashPaymentsSummary(): Promise<PaymentMethodSummary> {
  return paymentMethodSummary("walk_in");
}

/**
 * A short-lived URL for a receipt image. The bucket is private, so this is the
 * only way an admin sees the file, and the link dies in ten minutes.
 */
export async function signedReceiptUrl(path: string): Promise<string | null> {
  const { data } = await adminClient()
    .storage.from("receipts")
    .createSignedUrl(path, 600);

  return data?.signedUrl ?? null;
}

/**
 * Maps every admin's user id to their email — `registrations.reviewed_by`
 * is a bare `auth.users` id, and there's no admin-facing profile table to
 * join against, so this reads straight from Supabase Auth via the
 * service-role client. One call covers everyone: the admin team is a
 * handful of people, well under `listUsers()`'s default page size.
 */
export async function listAdminEmails(): Promise<Map<string, string>> {
  const { data, error } = await adminClient().auth.admin.listUsers();
  if (error) {
    console.error("listAdminEmails failed", error);
    return new Map();
  }
  return new Map(data.users.map((user) => [user.id, user.email ?? user.id]));
}

export type TicketEmailRecipient = {
  id: string;
  fullName: string;
  email: string;
  ticketCode: string;
};

/**
 * Approved payees whose ticket email has never gone out.
 *
 * Filtering on `ticket_email_sent_at is null` rather than a flag on the send
 * is what makes the button safe to press twice: a second run picks up only
 * whoever is left — the ones a failed batch missed, plus anyone approved in
 * the meantime — instead of emailing the whole event again.
 *
 * Oldest first: if a day's sending quota runs out partway through, it runs
 * out on the students who have been waiting the least.
 */
export async function pendingTicketEmailRecipients(): Promise<
  TicketEmailRecipient[] | null
> {
  const { data, error } = await adminClient()
    .from("registrations")
    .select("id, full_name, email, ticket_code")
    .eq("status", "approved")
    .is("ticket_email_sent_at", null)
    .order("created_at", { ascending: true });

  // Null, not an empty list: before migration 0009 is pasted into the hosted
  // project this column doesn't exist and the query 400s. "Couldn't read the
  // queue" and "the queue is empty" have to stay distinguishable — reporting
  // the second when the first is true tells an admin every student has their
  // ticket while the whole event is still waiting.
  if (error) {
    console.error("pendingTicketEmailRecipients failed", error);
    return null;
  }

  return (data ?? [])
    // An approved row always has a code (the ticket_code_matches_status
    // check constraint), so this filter is belt-and-braces — but it also
    // narrows the type, and a code-less email would be a blank QR.
    .filter((row) => Boolean(row.ticket_code))
    .map((row) => ({
      id: row.id as string,
      fullName: row.full_name as string,
      email: row.email as string,
      ticketCode: row.ticket_code as string,
    }));
}

/**
 * How many are still waiting — for the Dashboard's send card. Null carries
 * the same "couldn't read it" meaning as above, so the card can say that
 * rather than render a confident 0.
 */
export async function pendingTicketEmailCount(): Promise<number | null> {
  const { count, error } = await adminClient()
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .is("ticket_email_sent_at", null);

  if (error) {
    console.error("pendingTicketEmailCount failed", error);
    return null;
  }
  return count ?? 0;
}

/** Stamped only after Resend accepts the send — never before. */
export async function markTicketEmailSent(registrationIds: string[]): Promise<void> {
  if (registrationIds.length === 0) return;

  const { error } = await adminClient()
    .from("registrations")
    .update({ ticket_email_sent_at: new Date().toISOString() })
    .in("id", registrationIds);

  if (error) console.error("markTicketEmailSent failed", error);
}
