import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import type { Category } from "@/lib/config/battle";
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
  return writeFlag(PAYMENTS_OPEN_KEY, open);
}

async function writeFlag(key: string, on: boolean): Promise<boolean> {
  const { error } = await adminClient().from("settings").upsert({
    key,
    value: on ? "true" : "false",
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error(`setting ${key} failed`, error);
    return false;
  }
  return true;
}

const VOTING_OPEN_KEY = "voting_open";

/**
 * The Crowd's Choice switches. Read through the same fail-closed
 * `readOpenFlag` as the payment line: a missing row or a failed read means
 * voting is closed and the result is hidden — a vote that can't confirm it is
 * open must not take ballots, and a result must never leak early.
 *
 * `votingOpen()` is read on every /vote page load and every ballot, with
 * hundreds of phones arriving together, so it is remembered for a few
 * seconds. `setVotingOpen()` clears it on the instance that handled the
 * click; other instances catch up within the window — which is also how long
 * a ballot can still land after an admin closes voting.
 */
const VOTING_CACHE_MS = 5_000;
let votingCache: { at: number; open: boolean } | null = null;

export async function votingOpen(): Promise<boolean> {
  if (votingCache && Date.now() - votingCache.at < VOTING_CACHE_MS) {
    return votingCache.open;
  }
  const open = await readFlag(VOTING_OPEN_KEY);
  votingCache = { at: Date.now(), open };
  return open;
}

export async function setVotingOpen(open: boolean): Promise<boolean> {
  votingCache = null;
  return writeFlag(VOTING_OPEN_KEY, open);
}

/**
 * Each category's winner is revealed on its own (`band_revealed`,
 * `solo_revealed`), so the emcee can announce the band, then the solo.
 * Not cached: only the admin projector asks, and it must not lag a Reveal.
 */
const revealKey = (category: Category) => `${category}_revealed`;

export async function categoryRevealed(category: Category): Promise<boolean> {
  return readFlag(revealKey(category));
}

export async function setCategoryRevealed(
  category: Category,
  revealed: boolean,
): Promise<boolean> {
  return writeFlag(revealKey(category), revealed);
}

async function readFlag(key: string): Promise<boolean> {
  try {
    const { data, error } = await adminClient()
      .from("settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    return readOpenFlag(data?.value ?? null);
  } catch (error) {
    console.error(`setting ${key} read failed`, error);
    return false;
  }
}
