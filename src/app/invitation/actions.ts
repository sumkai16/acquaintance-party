"use server";

import { cookies } from "next/headers";
import { ENTERED_COOKIE, ENTERED_COOKIE_MAX_AGE } from "@/lib/faculty/cookie";
import { LETTER_VERSION } from "@/lib/faculty/letter";
import { facultyEntrySchema } from "@/lib/faculty/schema";
import { recordAcknowledgement } from "@/lib/faculty/queries";

export type FormState = {
  status: "idle" | "error" | "entered";
  /** The confirmation line on success, or the whole-form error on failure. */
  message?: string;
  fieldErrors?: Partial<Record<"fullName" | "acknowledged", string>>;
  /** What they typed, so an error round trip doesn't blank the form. */
  values?: { fullName: string };
  /** Bumped every submit, to re-key the inputs — see invitation-form.tsx. */
  attempt: number;
};

/**
 * Records one acknowledgement, which is also one giveaway entry.
 *
 * Reached from a shared QR with no session behind it, so everything here is
 * re-validated server-side — the checkbox included. A name already on the
 * list is not an error: the person almost certainly scanned twice, and being
 * told "you're already in" is the right answer, not a failure.
 */
export async function submitAcknowledgement(
  previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = {
    fullName: String(formData.get("fullName") ?? ""),
  };
  const attempt = previous.attempt + 1;

  const parsed = facultyEntrySchema.safeParse({
    ...values,
    // An unticked checkbox is absent from FormData entirely, so this is false
    // rather than undefined — which is what the schema's literal(true) rejects.
    acknowledged: formData.get("acknowledged") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: FormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "fullName" || field === "acknowledged") {
        fieldErrors[field] ??= issue.message;
      }
    }
    return { status: "error", fieldErrors, values, attempt };
  }

  const result = await recordAcknowledgement({
    fullName: parsed.data.fullName,
    letterVersion: LETTER_VERSION,
  });

  if (!result.ok && result.error === "failed") {
    return {
      status: "error",
      message: "Something went wrong saving this. Try again in a moment.",
      values,
      attempt,
    };
  }

  await markEntered(parsed.data.fullName);

  return {
    status: "entered",
    message: result.ok
      ? "Thank you — you're on the list."
      : "You're already on the list, so there's nothing more to do.",
    values,
    attempt,
  };
}

async function markEntered(fullName: string): Promise<void> {
  (await cookies()).set(ENTERED_COOKIE, fullName, {
    maxAge: ENTERED_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
    // No httpOnly: nothing here is a credential, and the value is the
    // person's own name, which they just typed on this device.
  });
}
