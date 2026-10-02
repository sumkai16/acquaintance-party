"use server";

import { validateBallot } from "@/lib/votes/ballot";
import { castVote, checkedInVoters } from "@/lib/votes/queries";
import { findVoter } from "@/lib/votes/voters";
import { votingOpen } from "@/lib/settings/queries";

export type VoteState = {
  status: "idle" | "error" | "voted";
  message?: string;
  /** What they picked, so an error round trip doesn't blank the form. */
  values?: { name: string; email: string; band: string; solo: string };
};

const NOT_YOU =
  "That email doesn't match the name you picked. Use the email you registered " +
  "with — or message an organiser if you're not sure which one it was.";

/**
 * Casts one ballot from /vote.
 *
 * Reached by an unauthenticated student, so nothing the form said is
 * trusted: voting being open, the ballot, and who the voter is are all
 * re-checked here. Identity is the picked name *and* the registered email
 * together (findVoter), against people actually scanned in at the door. The
 * one-vote rule is the unique index on crowd_votes, not a check here — a
 * second ballot loses there and is reported as "already voted".
 */
export async function submitVote(_prev: VoteState, formData: FormData): Promise<VoteState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    band: String(formData.get("band") ?? ""),
    solo: String(formData.get("solo") ?? ""),
  };

  if (!(await votingOpen())) {
    return { status: "error", message: "Voting isn't open right now.", values };
  }

  if (!values.name.trim()) {
    return { status: "error", message: "Search for your name and pick it from the list.", values };
  }
  if (!values.email.trim()) {
    return { status: "error", message: "Enter the email you registered with.", values };
  }

  const ballot = validateBallot({ band: values.band, solo: values.solo });
  if (!ballot.ok) return { status: "error", message: ballot.error, values };

  let voter;
  try {
    voter = findVoter(await checkedInVoters(), values.name, values.email);
  } catch {
    return {
      status: "error",
      message: "Something went wrong on our end. Try again in a moment.",
      values,
    };
  }
  if (!voter) return { status: "error", message: NOT_YOU, values };

  const result = await castVote(voter.registrationId, ballot.band, ballot.solo);

  if (!result.ok && result.error === "failed") {
    return {
      status: "error",
      message: "Your vote didn't save. Try again in a moment.",
      values,
    };
  }

  return {
    status: "voted",
    message: result.ok
      ? "Thanks — your vote is in."
      : "You've already voted, so there's nothing more to do.",
    values,
  };
}
