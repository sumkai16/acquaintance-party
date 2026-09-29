import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { EmailCorrectionRequest } from "@/lib/supabase/types";
import type { HelpCategory } from "@/lib/registrations/schema";

/**
 * Records a "report a QR problem" request from /find. Never changes the
 * registration itself — see requestHelp's comment in
 * src/app/find/actions.ts for why that has to stay a human decision.
 */
export async function createEmailFixRequest(input: {
  studentId: string;
  fullName: string;
  category: HelpCategory;
  requestedEmail: string | null;
  message: string | null;
  registrationId: string | null;
}): Promise<void> {
  const { error } = await adminClient().from("email_correction_requests").insert({
    student_id: input.studentId,
    full_name: input.fullName,
    category: input.category,
    requested_email: input.requestedEmail,
    message: input.message,
    registration_id: input.registrationId,
  });

  if (error) console.error("createEmailFixRequest failed", error);
}

/** How many requests this student ID has made recently — the /find throttle. */
export async function countRecentEmailFixRequests(
  studentId: string,
  sinceIso: string,
): Promise<number> {
  const { count } = await adminClient()
    .from("email_correction_requests")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .gte("created_at", sinceIso);

  return count ?? 0;
}

/**
 * Same throttle, keyed on the destination address instead — catches someone
 * cycling through several student IDs (typos, guesses, or someone else's)
 * while aiming at the same inbox each time, which the student-ID throttle
 * alone can't see since every ID it tries looks "fresh."
 */
export async function countRecentEmailFixRequestsByEmail(
  requestedEmail: string,
  sinceIso: string,
): Promise<number> {
  const { count } = await adminClient()
    .from("email_correction_requests")
    .select("id", { count: "exact", head: true })
    .eq("requested_email", requestedEmail)
    .gte("created_at", sinceIso);

  return count ?? 0;
}

/**
 * The admin queue at /admin/email-fixes — open (unresolved) requests by
 * default, oldest first so the longest-waiting student surfaces first;
 * `status: "resolved"` shows the history instead, newest first.
 */
export async function listEmailFixRequests(
  status: "open" | "resolved" = "open",
): Promise<EmailCorrectionRequest[]> {
  const query = adminClient()
    .from("email_correction_requests")
    .select("*")
    .order("created_at", { ascending: status === "open" });

  const { data } =
    status === "open"
      ? await query.is("resolved_at", null)
      : await query.not("resolved_at", "is", null);

  return (data as EmailCorrectionRequest[]) ?? [];
}

export type ResolveEmailFixResult = { ok: true } | { ok: false; error: string };

/**
 * Marks a request handled — staff has already fixed the address over on the
 * Dashboard's Find/edit flow by this point; this is only the bookkeeping.
 * `.is("resolved_at", null)` on the update is a light race guard: a second
 * click (two tabs, a slow network retry) matches zero rows and reports
 * already_resolved instead of overwriting who resolved it first.
 */
export async function resolveEmailFixRequest(
  id: string,
  resolvedBy: string,
): Promise<ResolveEmailFixResult> {
  const { data, error } = await adminClient()
    .from("email_correction_requests")
    .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq("id", id)
    .is("resolved_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("resolveEmailFixRequest failed", error);
    return { ok: false, error: "Could not mark this resolved. Try again." };
  }
  if (!data) return { ok: false, error: "Already resolved." };

  return { ok: true };
}
