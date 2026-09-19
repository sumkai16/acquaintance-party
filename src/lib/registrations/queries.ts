import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { generateTicketCode } from "@/lib/tickets/generate";
import type {
  PaymentMethod,
  Registration,
  RegistrationStatus,
  ReviewStatus,
} from "@/lib/supabase/types";
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
  // it — a full walk-in is approved on the spot, so this is the only moment
  // it is in hand without a second read. null for a partial sale: no ticket
  // exists until the balance is paid.
  | { ok: true; id: string; ticketCode: string | null }
  | { ok: false; error: "duplicate_student_id" | "failed" };

/**
 * A cash sale entered directly by an admin or staff member.
 *
 * `partialAmountCentavos`, when given, records that admin-entered amount
 * (validated against `isValidPartialAmount` by the caller before this is
 * reached — see admin/walk-in/actions.ts) as `status: "partial"` — no
 * ticket_code, no QR, until `completeWalkInBalance` is called for the rest.
 * Otherwise this is approved immediately, since staff already has the full
 * cash in hand and there's no receipt to review. Retries on a ticket-code
 * collision the same way approveRegistration does in
 * admin/review/actions.ts — skipped entirely for a partial sale, which
 * mints no code yet.
 */
export async function createWalkInRegistration(
  input: WalkInInput & {
    amount: number;
    reviewedBy: string;
    importBatchId?: string;
    partialAmountCentavos?: number;
  },
): Promise<CreateWalkInResult> {
  const base = {
    full_name: input.fullName,
    student_id: input.studentId,
    year_level: input.yearLevel,
    section: input.section,
    email: input.email,
    payment_method: "walk_in" as const,
    gcash_reference: null,
    receipt_path: null,
    amount: input.amount,
    reviewed_at: new Date().toISOString(),
    reviewed_by: input.reviewedBy,
    // Only set when the row came from a bulk import. Left out of the
    // insert otherwise, so a single walk-in sale doesn't depend on
    // migration 0012 existing.
    ...(input.importBatchId ? { import_batch_id: input.importBatchId } : {}),
  };

  if (input.partialAmountCentavos !== undefined) {
    const { data, error } = await adminClient()
      .from("registrations")
      .insert({
        ...base,
        status: "partial",
        ticket_code: null,
        amount_paid: input.partialAmountCentavos,
      })
      .select("id")
      .single();

    if (!error) return { ok: true, id: data.id, ticketCode: null };
    if (error.code === UNIQUE_VIOLATION && isStudentIdViolation(error.message)) {
      return { ok: false, error: "duplicate_student_id" };
    }
    console.error("createWalkInRegistration (partial) failed", error);
    return { ok: false, error: "failed" };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await adminClient()
      .from("registrations")
      .insert({
        ...base,
        status: "approved",
        ticket_code: generateTicketCode(),
        amount_paid: input.amount,
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

export type CompleteWalkInBalanceResult =
  | {
      ok: true;
      id: string;
      ticketCode: string;
      email: string;
      fullName: string;
      studentId: string;
      /** What this completion actually collected — full price minus whatever was already paid, not assumed to be any fixed split. */
      collectedNowCentavos: number;
    }
  | { ok: false; error: "not_partial" | "failed" };

/**
 * Settles the remaining balance of a partial walk-in — mints the ticket code
 * (same retry-on-collision loop as approveRegistration) and moves the row to
 * `approved`. `.eq("status", "partial")` on the update is the race guard: if
 * two people complete the same balance at once, the second UPDATE matches
 * zero rows and comes back as `not_partial` rather than emailing the QR
 * twice. The amount already paid can be any admin-entered figure (no fixed
 * split), so it's read once up front to report what this completion
 * actually collects — a stale read here only loses a display number, since
 * the update's own guard is what actually prevents a double-settle.
 */
export async function completeWalkInBalance(
  id: string,
  fullAmountCentavos: number,
): Promise<CompleteWalkInBalanceResult> {
  const before = await adminClient()
    .from("registrations")
    .select("amount_paid")
    .eq("id", id)
    .eq("status", "partial")
    .maybeSingle();
  if (!before.data) return { ok: false, error: "not_partial" };
  const collectedNowCentavos = fullAmountCentavos - (before.data.amount_paid as number);

  for (let attempt = 0; attempt < 5; attempt++) {
    const ticketCode = generateTicketCode();

    const { data, error } = await adminClient()
      .from("registrations")
      .update({
        status: "approved",
        ticket_code: ticketCode,
        amount_paid: fullAmountCentavos,
      })
      .eq("id", id)
      .eq("status", "partial")
      .select("email, full_name, student_id")
      .maybeSingle();

    if (!error) {
      if (!data) return { ok: false, error: "not_partial" };
      return {
        ok: true,
        id,
        ticketCode,
        email: data.email,
        fullName: data.full_name,
        studentId: data.student_id,
        collectedNowCentavos,
      };
    }
    if (error.code === UNIQUE_VIOLATION) continue; // ticket-code collision — try again
    console.error("completeWalkInBalance failed", error);
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

/**
 * Walk-in sales still waiting on their remaining balance, oldest first — feeds
 * the "Outstanding balances" list on /admin/walk-in, which staff and admin
 * both need since staff can't reach Find a registration.
 */
export async function listPartialWalkIns(): Promise<Registration[]> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("payment_method", "walk_in")
    .eq("status", "partial")
    .order("created_at", { ascending: true });

  return (data as Registration[]) ?? [];
}

export async function getRegistration(id: string): Promise<Registration | null> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  return (data as Registration) ?? null;
}

/**
 * Online submissions in one status, oldest first — the Payments page. Walk-ins
 * are left out: they never pass through review and have no receipt to show.
 */
export async function listForReview(
  status: ReviewStatus,
): Promise<Registration[]> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("status", status)
    .eq("payment_method", "online")
    .order("created_at", { ascending: true });

  return (data as Registration[]) ?? [];
}

/** Online submissions per status, for the Payments page's filter and stats. */
export async function reviewStatusCounts(): Promise<Record<ReviewStatus, number>> {
  const count = async (status: ReviewStatus) => {
    const { count } = await adminClient()
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("status", status)
      .eq("payment_method", "online");
    return count ?? 0;
  };
  const [pending, approved, rejected] = await Promise.all([
    count("pending"),
    count("approved"),
    count("rejected"),
  ]);
  return { pending, approved, rejected };
}

/**
 * How many registrations carry each of these GCash references, in one query
 * instead of one per row — the Approved list on Payments can run to hundreds.
 */
export async function countByReferences(
  references: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (references.length === 0) return counts;

  const { data } = await adminClient()
    .from("registrations")
    .select("gcash_reference")
    .in("gcash_reference", references);

  for (const row of data ?? []) {
    const ref = row.gcash_reference as string;
    counts.set(ref, (counts.get(ref) ?? 0) + 1);
  }
  return counts;
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
    /**
     * Who is still owed an email — the same two groups the Dashboard's
     * Receipts card counts. `qr`: paid in full, QR never emailed. `receipt`:
     * has at least one receipt nobody has emailed them yet.
     */
    delivery?: "qr" | "receipt";
  } = {},
): Promise<RegistrationsPage> {
  const trimmed = query.trim();
  // Escape PostgREST's pattern wildcards and its comma/parenthesis
  // separators so a search for "a,b" cannot break out of the filter.
  const safe = trimmed.replace(/[%_,()\\]/g, "");
  const hasQuery = safe.length >= 2;

  const { sort = null, direction = "desc", yearLevel, delivery } = options;

  if (!hasQuery && !status && !paymentMethod && !yearLevel && !delivery) {
    return { rows: [], total: 0 };
  }

  // Waiting for a receipt means "has an unemailed receipt": an inner join
  // keeps only registrations with at least one receipt matching the filter.
  let builder = adminClient()
    .from("registrations")
    .select(delivery === "receipt" ? "*, receipts!inner(id)" : "*", { count: "exact" });
  if (hasQuery) builder = builder.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  if (status && status !== "all") builder = builder.eq("status", status);
  if (paymentMethod && paymentMethod !== "all") builder = builder.eq("payment_method", paymentMethod);
  if (yearLevel) builder = builder.eq("year_level", yearLevel);
  if (delivery === "qr") {
    builder = builder.eq("status", "approved").is("ticket_email_sent_at", null);
  }
  if (delivery === "receipt") {
    // Voided tickets are excluded, same as the backlog — nobody is emailing them.
    builder = builder.neq("status", "rejected").is("receipts.emailed_at", null);
  }

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

  // Via unknown: the select string varies with `delivery`, so the client can't
  // infer one row shape. The extra `receipts` key the join adds is ignored.
  return { rows: (data as unknown as Registration[]) ?? [], total: count ?? 0 };
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

/**
 * Approved online (GCash) payments only — how many students paid this way,
 * and how much that's worth. Walk-in cash sales are tracked separately on
 * the Cash page, since they're a different custody question (who's holding
 * the cash) rather than "how many people paid online." There is no partial
 * concept for online — see cashPaymentsSummary for the walk-in counterpart,
 * which does have one.
 */
export async function onlinePaymentsSummary(): Promise<PaymentMethodSummary> {
  const { data } = await adminClient()
    .from("registrations")
    .select("amount")
    .eq("payment_method", "online")
    .eq("status", "approved");

  const rows = data ?? [];
  return {
    count: rows.length,
    totalCentavos: rows.reduce((sum, row) => sum + (row.amount as number), 0),
  };
}

/**
 * Approved and partial walk-in (cash) payments — the counterpart to
 * onlinePaymentsSummary. Includes `partial` rows so a partial payment already
 * sitting with a staff member isn't invisible to the cash total; sums
 * `amount_paid`, not `amount`, so a partial row only counts what has
 * actually been collected on it so far.
 */
export async function cashPaymentsSummary(): Promise<PaymentMethodSummary> {
  const { data } = await adminClient()
    .from("registrations")
    .select("amount_paid")
    .eq("payment_method", "walk_in")
    .in("status", ["approved", "partial"]);

  const rows = data ?? [];
  return {
    count: rows.length,
    totalCentavos: rows.reduce((sum, row) => sum + (row.amount_paid as number), 0),
  };
}

/**
 * A short-lived URL for a receipt image. The bucket is private, so this is the
 * only way an admin sees the file, and the link dies in ten minutes.
 */
export async function signedReceiptUrls(
  paths: string[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;

  // One storage call for the whole list, not one per row.
  const { data } = await adminClient()
    .storage.from("receipts")
    .createSignedUrls(paths, 600);

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
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

/** Stamped only after Resend accepts the send — never before. */
export async function markTicketEmailSent(registrationIds: string[]): Promise<void> {
  if (registrationIds.length === 0) return;

  const { error } = await adminClient()
    .from("registrations")
    .update({ ticket_email_sent_at: new Date().toISOString() })
    .in("id", registrationIds);

  if (error) console.error("markTicketEmailSent failed", error);
}

/**
 * Puts a registration back in the "Send to N" queue after Resend reports
 * the ticket email bounced — "accepted" and "delivered" aren't the same
 * thing, and only the webhook (src/app/api/webhooks/resend) finds out which
 * one actually happened. See markTicketEmailSent's comment: null is what
 * means "still needs sending" here, same as it did before this was ever
 * stamped.
 */
export async function clearTicketEmailSent(registrationId: string): Promise<void> {
  const { error } = await adminClient()
    .from("registrations")
    .update({ ticket_email_sent_at: null })
    .eq("id", registrationId);

  if (error) console.error("clearTicketEmailSent failed", error);
}
