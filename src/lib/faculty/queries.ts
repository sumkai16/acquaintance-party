import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { FacultyInvitation } from "@/lib/supabase/types";

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";

export type RecordResult =
  | { ok: true; entry: FacultyInvitation }
  | { ok: false; error: "already_entered" | "failed" };

/**
 * Writes one acknowledgement, which is also one giveaway entry.
 *
 * The unique index on the normalized name is the duplicate guard, not a
 * lookup-then-insert in app code: the QR is shared, so two people submitting
 * the same name at the same moment race here rather than past a check that
 * both would pass. `already_entered` is a normal outcome the page turns into
 * a friendly "you're on the list" state, never an error — same shape as
 * saveEvaluation() in src/lib/evaluation/queries.ts.
 */
export async function recordAcknowledgement(input: {
  fullName: string;
  letterVersion: string;
}): Promise<RecordResult> {
  const { data, error } = await adminClient()
    .from("faculty_invitations")
    .insert({
      full_name: input.fullName,
      letter_version: input.letterVersion,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      return { ok: false, error: "already_entered" };
    }
    console.error("recordAcknowledgement failed", error);
    return { ok: false, error: "failed" };
  }

  return { ok: true, entry: data as FacultyInvitation };
}

/**
 * Everyone who has acknowledged the letter, newest first — the adviser's RSVP
 * list, and the source of the faculty raffle pool.
 *
 * There is no "hasn't opened it yet" counterpart, and there cannot be: one
 * shared QR means the app never learns who it was sent to. See the header of
 * 0017_faculty_raffle.sql.
 */
export async function listAcknowledgements(): Promise<FacultyInvitation[]> {
  const { data, error } = await adminClient()
    .from("faculty_invitations")
    .select("*")
    .order("acknowledged_at", { ascending: false });

  if (error) {
    console.error("listAcknowledgements failed", error);
    throw new Error("Could not load the faculty list.");
  }

  return (data ?? []) as FacultyInvitation[];
}

/** Whether this name is already on the list, for the repeat-visit state. */
export async function hasAcknowledged(fullName: string): Promise<boolean> {
  const { data, error } = await adminClient()
    .from("faculty_invitations")
    .select("id")
    .ilike("full_name", fullName.trim())
    .maybeSingle();

  if (error) {
    console.error("hasAcknowledged failed", error);
    return false;
  }
  return data !== null;
}

/**
 * Removes one entry. The escape hatch for a junk name submitted through the
 * shared QR — a hard delete rather than a void, because unlike a payment or a
 * ticket there is nothing here worth keeping an audit trail of.
 */
export async function deleteAcknowledgement(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await adminClient()
    .from("faculty_invitations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteAcknowledgement failed", error);
    return { ok: false, error: "Could not remove that entry. Try again." };
  }
  return { ok: true };
}
