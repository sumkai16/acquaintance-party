import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { generateTicketCode } from "@/lib/tickets/generate";
import type { Registration, RegistrationStatus } from "@/lib/supabase/types";
import type { CheckoutInput, WalkInInput } from "./schema";

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

export type CreateWalkInResult =
  | { ok: true; id: string }
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
      .select("id")
      .single();

    if (!error) return { ok: true, id: data.id };

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
 * Finds registrations by partial name or email, for a student at the door
 * who has lost their ticket link. Capped at 50 so a one-letter search cannot
 * drag the whole table down mid-event.
 *
 * `status` also lets this browse without a query at all — "all" (or a
 * specific status) with an empty query lists registrations directly,
 * covering what used to be a separate Rejections page. With neither a
 * query nor a status, there is nothing to show yet.
 */
export async function searchRegistrations(
  query: string,
  status?: "all" | RegistrationStatus,
): Promise<Registration[]> {
  const trimmed = query.trim();
  // Escape PostgREST's pattern wildcards and its comma/parenthesis
  // separators so a search for "a,b" cannot break out of the filter.
  const safe = trimmed.replace(/[%_,()\\]/g, "");
  const hasQuery = safe.length >= 2;

  if (!hasQuery && !status) return [];

  let builder = adminClient().from("registrations").select("*");
  if (hasQuery) builder = builder.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
  if (status && status !== "all") builder = builder.eq("status", status);

  // Rejected rows read newest-rejected-first; everything else reads
  // newest-submitted-first — matches what the old dedicated Rejections
  // page did before it was folded into this search.
  const orderColumn = status === "rejected" ? "reviewed_at" : "created_at";
  const { data } = await builder
    .order(orderColumn, { ascending: false })
    .limit(50);

  return (data as Registration[]) ?? [];
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
