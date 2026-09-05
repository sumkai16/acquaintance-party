import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { QUESTIONS, RATING_SCALE } from "./questions";
import type { Answers } from "./schema";
import type { Evaluation, Registration } from "@/lib/supabase/types";

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";

/**
 * Everyone with at least one `ok` scan, and when they first came through the
 * door. Same definition of "attended" as approvedManifest() in
 * src/lib/scans/queries.ts — attendance is derived from the append-only scan
 * log, never stored as a flag on the registration.
 */
async function checkInTimes(): Promise<Map<string, string>> {
  const { data, error } = await adminClient()
    .from("scans")
    .select("registration_id, scanned_at")
    .eq("result", "ok")
    .not("registration_id", "is", null);

  if (error) {
    console.error("checkInTimes failed", error);
    throw new Error("Could not load attendance.");
  }

  const earliest = new Map<string, string>();
  for (const row of data ?? []) {
    const id = row.registration_id as string;
    const at = row.scanned_at as string;
    const existing = earliest.get(id);
    if (!existing || at < existing) earliest.set(id, at);
  }
  return earliest;
}

/** When this one registration was first scanned in, or null if never. */
export async function checkedInAt(registrationId: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from("scans")
    .select("scanned_at")
    .eq("registration_id", registrationId)
    .eq("result", "ok")
    .order("scanned_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("checkedInAt failed", error);
    return null;
  }
  return (data?.scanned_at as string) ?? null;
}

export type EvaluationContext = {
  registration: Registration;
  /** Null means they never came through the door — no evaluation, no certificate. */
  checkedInAt: string | null;
  /** The response they already submitted, if any. */
  evaluation: Evaluation | null;
};

/**
 * Everything both the evaluation form and the certificate page need, in one
 * lookup: who this is, whether they attended, and whether they've already
 * answered.
 */
export async function evaluationContext(
  registrationId: string,
): Promise<EvaluationContext | null> {
  const { data: registration } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("id", registrationId)
    .maybeSingle();

  if (!registration) return null;

  const [scannedAt, evaluation] = await Promise.all([
    checkedInAt(registrationId),
    getEvaluation(registrationId),
  ]);

  return {
    registration: registration as Registration,
    checkedInAt: scannedAt,
    evaluation,
  };
}

export async function getEvaluation(
  registrationId: string,
): Promise<Evaluation | null> {
  const { data } = await adminClient()
    .from("evaluations")
    .select("*")
    .eq("registration_id", registrationId)
    .maybeSingle();

  return (data as Evaluation) ?? null;
}

export type SaveResult =
  | { ok: true }
  | { ok: false; error: "already_submitted" | "failed" };

export async function saveEvaluation(
  registrationId: string,
  formVersion: string,
  answers: Answers,
): Promise<SaveResult> {
  const { error } = await adminClient().from("evaluations").insert({
    registration_id: registrationId,
    form_version: formVersion,
    answers,
  });

  if (error) {
    // The unique index on registration_id is the real duplicate guard — two
    // taps on Submit race here rather than past a client-side check.
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: "already_submitted" };
    }
    console.error("saveEvaluation failed", error);
    return { ok: false, error: "failed" };
  }

  return { ok: true };
}

/** A registration looked up by its certificate serial, for the verify page. */
export async function findByTicketCode(
  code: string,
): Promise<Registration | null> {
  const { data } = await adminClient()
    .from("registrations")
    .select("*")
    .eq("ticket_code", code)
    .maybeSingle();

  return (data as Registration) ?? null;
}

export type InviteRecipient = {
  id: string;
  fullName: string;
  email: string;
};

/**
 * Checked-in attendees who haven't been emailed an invite yet.
 *
 * Filtering on `evaluation_invited_at is null` rather than a single "already
 * sent" flag on the batch is what makes the send button safe to press twice: a
 * second run catches only whoever is left, including attendees whose door scan
 * synced after the first send.
 */
export async function pendingInviteRecipients(): Promise<InviteRecipient[]> {
  const [attended, { data, error }] = await Promise.all([
    checkInTimes(),
    adminClient()
      .from("registrations")
      .select("id, full_name, email")
      .eq("status", "approved")
      .is("evaluation_invited_at", null),
  ]);

  if (error) {
    console.error("pendingInviteRecipients failed", error);
    return [];
  }

  return (data ?? [])
    .filter((row) => attended.has(row.id as string))
    .map((row) => ({
      id: row.id as string,
      fullName: row.full_name as string,
      email: row.email as string,
    }));
}

export async function markInvited(registrationIds: string[]): Promise<void> {
  if (registrationIds.length === 0) return;

  const { error } = await adminClient()
    .from("registrations")
    .update({ evaluation_invited_at: new Date().toISOString() })
    .in("id", registrationIds);

  if (error) console.error("markInvited failed", error);
}

export type QuestionSummary =
  | {
      kind: "rating";
      id: string;
      prompt: string;
      average: number | null;
      /** Response count per point on the scale, in RATING_SCALE order. */
      counts: number[];
    }
  | {
      kind: "choice";
      id: string;
      prompt: string;
      counts: { option: string; count: number }[];
    }
  | { kind: "text"; id: string; prompt: string; responses: string[] };

export type EvaluationSummary = {
  responses: number;
  checkedIn: number;
  invited: number;
  questions: QuestionSummary[];
};

/**
 * The admin view of the results: totals only, no names.
 *
 * Responses are stored against the registration so a duplicate can be
 * rejected and the certificate can be gated, but nothing here carries who
 * said what — including the free-text answers, which are returned as a bare
 * list in submission order.
 */
export async function evaluationSummary(): Promise<EvaluationSummary> {
  const [attended, invitedCount, { data, error }] = await Promise.all([
    checkInTimes(),
    adminClient()
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .not("evaluation_invited_at", "is", null),
    adminClient()
      .from("evaluations")
      .select("answers")
      .order("submitted_at", { ascending: true }),
  ]);

  if (error) {
    console.error("evaluationSummary failed", error);
  }

  const rows = (data ?? []).map((row) => row.answers as Answers);

  const questions: QuestionSummary[] = QUESTIONS.map((question) => {
    if (question.kind === "rating") {
      const values = rows
        .map((row) => row[question.id])
        .filter((value): value is number => typeof value === "number");
      const counts = RATING_SCALE.map(
        (point) => values.filter((value) => value === point).length,
      );
      const average =
        values.length === 0
          ? null
          : values.reduce((sum, value) => sum + value, 0) / values.length;
      return { kind: "rating", id: question.id, prompt: question.prompt, average, counts };
    }

    if (question.kind === "choice") {
      return {
        kind: "choice",
        id: question.id,
        prompt: question.prompt,
        counts: question.options.map((option) => ({
          option,
          count: rows.filter((row) => row[question.id] === option).length,
        })),
      };
    }

    return {
      kind: "text",
      id: question.id,
      prompt: question.prompt,
      responses: rows
        .map((row) => row[question.id])
        .filter((value): value is string => typeof value === "string" && value !== ""),
    };
  });

  return {
    responses: rows.length,
    checkedIn: attended.size,
    invited: invitedCount.count ?? 0,
    questions,
  };
}
