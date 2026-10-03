"use server";

import { redirect } from "next/navigation";
import { checkedInVoters } from "@/lib/votes/queries";
import { findVoter } from "@/lib/votes/voters";

export type LookupState = {
  status: "idle" | "error";
  message?: string;
  /** What they typed, so an error round trip doesn't blank the form. */
  values?: { name: string; email: string };
};

const NOT_YOU =
  "We couldn't find that name and email among the people scanned in at the door. " +
  "Check the spelling, use the email you registered with, or message an organiser.";

/**
 * Finds a student's own evaluation from the shared QR.
 *
 * Reached by an unauthenticated student, so nothing the form said is trusted.
 * The same identity rule as the Crowd's Choice ballot: the typed name *and*
 * the registered email together (findVoter), against people actually scanned
 * in at the door. A match is sent on to /evaluate/<their id>, which is the
 * page the emailed invite already links to and which does its own checks
 * (door scan, balance, already answered). Nothing is created or changed here.
 */
export async function openMyEvaluation(
  _prev: LookupState,
  formData: FormData,
): Promise<LookupState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };

  if (!values.name.trim()) {
    return { status: "error", message: "Enter your name — first and last.", values };
  }
  if (!values.email.trim()) {
    return { status: "error", message: "Enter the email you registered with.", values };
  }

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

  // Outside the try: redirect() works by throwing.
  redirect(`/evaluate/${voter.registrationId}`);
}
