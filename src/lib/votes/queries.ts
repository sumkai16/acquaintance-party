import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { VoteRow } from "./ballot";
import type { Voter } from "./voters";

/**
 * Who can vote: approved (or partial-with-QR) ticket holders with at least
 * one "ok" scan — the same definition of "was at the door" the raffle and
 * the attendance page use. Includes the email, which is the check and so
 * never leaves the server; callers hand the public only `VoterChoice`.
 */
async function loadVoters(): Promise<Voter[]> {
  const [registrations, checkIns] = await Promise.all([
    adminClient()
      .from("registrations")
      .select("id, full_name, year_level, section, email")
      .in("status", ["approved", "partial"])
      .not("ticket_code", "is", null),
    adminClient()
      .from("scans")
      .select("registration_id")
      .eq("result", "ok")
      .not("registration_id", "is", null),
  ]);

  if (registrations.error || checkIns.error) {
    console.error("loadVoters failed", registrations.error ?? checkIns.error);
    throw new Error("Could not load the list of people who can vote.");
  }

  const scannedIn = new Set(checkIns.data?.map((row) => row.registration_id as string));

  return (registrations.data ?? [])
    .filter((row) => scannedIn.has(row.id as string))
    .map((row) => ({
      registrationId: row.id as string,
      fullName: row.full_name as string,
      yearLevel: row.year_level as string,
      section: row.section as string,
      email: (row.email as string).trim().toLowerCase(),
    }));
}

/**
 * The voter list, remembered for 30 seconds and shared by everyone hitting
 * this server instance. Hundreds of students typing into the search box at
 * once would otherwise run two table scans per keystroke; with this it is
 * two per instance per half minute, and a search is a filter over memory.
 *
 * The in-flight promise is shared too, so a cold cache hit by a hundred
 * phones in the same second still loads once. A failed load is not cached.
 * The cost is that someone scanned in during the last 30 seconds may not
 * appear yet — the page tells them to try again in a minute.
 */
const VOTERS_CACHE_MS = 30_000;
let votersCache: { at: number; voters: Promise<Voter[]> } | null = null;

export function checkedInVoters(): Promise<Voter[]> {
  if (votersCache && Date.now() - votersCache.at < VOTERS_CACHE_MS) {
    return votersCache.voters;
  }
  const voters = loadVoters();
  votersCache = { at: Date.now(), voters };
  voters.catch(() => {
    if (votersCache?.voters === voters) votersCache = null;
  });
  return voters;
}

export type CastResult =
  | { ok: true }
  | { ok: false; error: "already_voted" | "failed" };

/**
 * Writes one ballot. The unique index on registration_id is the
 * one-vote-per-person rule: a second attempt loses with 23505, which is
 * "already voted", not a failure.
 */
export async function castVote(
  registrationId: string,
  band: string,
  solo: string,
): Promise<CastResult> {
  const { error } = await adminClient().from("crowd_votes").insert({
    registration_id: registrationId,
    band_choice: band,
    solo_choice: solo,
  });

  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, error: "already_voted" };
  console.error("castVote failed", error);
  return { ok: false, error: "failed" };
}

/** Every ballot, as bare choices — the tally is pure (ballot.ts). 700 rows at most. */
export async function allVotes(): Promise<VoteRow[]> {
  const { data, error } = await adminClient()
    .from("crowd_votes")
    .select("band_choice, solo_choice");

  if (error) {
    console.error("allVotes failed", error);
    throw new Error("Could not load the votes.");
  }
  return (data ?? []) as VoteRow[];
}
