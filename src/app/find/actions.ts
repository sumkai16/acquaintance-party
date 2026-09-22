"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { emailFixRequestSchema, normalizeStudentId } from "@/lib/registrations/schema";
import { emailDomainProblem } from "@/lib/registrations/mx";
import { isThrottled, throttleWindowStart } from "@/lib/registrations/abuse";
import { findOwnRegistration, findRegistrationByStudentId } from "@/lib/registrations/queries";
import { notifyEmailCorrectionRequest } from "@/lib/notify/discord";
import { countRecentEmailFixRequests, logActivity } from "@/lib/activity/queries";

export type FindState = {
  status: "idle" | "error";
  message?: string;
  /**
   * "no_match" specifically (not just any error) is what unlocks the
   * "request an email fix" form on the page — see find-form.tsx.
   */
  reason?: "missing_fields" | "no_match";
};

const initialMessage =
  "Enter both your student ID and the email you registered with.";

/**
 * One generic "no match" message regardless of which field was wrong — a
 * lookup that says "wrong email" or "wrong student ID" separately would let
 * someone probe for which student IDs are registered.
 */
const noMatchMessage =
  "No ticket found with that student ID and email. Check that both match " +
  "exactly what you submitted at checkout, or message an organiser.";

export async function findTicket(
  _prev: FindState,
  formData: FormData,
): Promise<FindState> {
  const studentId = normalizeStudentId(String(formData.get("studentId") ?? ""));
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!studentId || !email) {
    return { status: "error", message: initialMessage, reason: "missing_fields" };
  }

  const registration = await findOwnRegistration(studentId, email);
  if (!registration) {
    return { status: "error", message: noMatchMessage, reason: "no_match" };
  }

  redirect(`/ticket/${registration.id}`);
}

export type EmailFixState = {
  status: "idle" | "error" | "sent";
  message?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Never changes the address itself — anyone could type any student ID here,
 * so the only safe outcome is putting the request in front of a human. It
 * logs to activity_logs (so it's never lost, even if the Discord ping is
 * unconfigured or fails) and best-effort pings Discord for immediate
 * visibility, same as a new registration does.
 */
export async function requestEmailCorrection(
  _prev: EmailFixState,
  formData: FormData,
): Promise<EmailFixState> {
  const parsed = emailFixRequestSchema.safeParse({
    studentId: String(formData.get("studentId") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    requestedEmail: String(formData.get("requestedEmail") ?? ""),
  });

  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      fieldErrors[field] ??= issue.message;
    }
  } else {
    // Same check checkout/walk-in/edit already run: a well-formed address
    // whose domain has no mail server would just bounce again once staff
    // applies the "fix" — exactly the failure mode this form exists to close.
    const domainProblem = await emailDomainProblem(parsed.data.requestedEmail);
    if (domainProblem) fieldErrors.requestedEmail = domainProblem;
  }

  if (!parsed.success || fieldErrors.requestedEmail) {
    return { status: "error", message: "Check the highlighted fields.", fieldErrors };
  }

  const { studentId, fullName, requestedEmail } = parsed.data;

  const recent = await countRecentEmailFixRequests(studentId, throttleWindowStart(new Date()));
  if (isThrottled(recent)) {
    return {
      status: "error",
      message:
        "This student ID has requested a fix several times already. Wait a " +
        "moment, or message an organiser directly.",
    };
  }

  const registration = await findRegistrationByStudentId(studentId);

  await logActivity({
    userId: null,
    activityType: "email_correction_requested",
    description:
      `${fullName} (${studentId}) says the email on file is wrong and asks for it to be ` +
      `changed to ${requestedEmail}.` +
      (registration ? "" : " No registration found with that student ID to check it against."),
    registrationId: registration?.id,
  });

  after(async () => {
    await notifyEmailCorrectionRequest({ studentId, fullName, requestedEmail });
  });

  return {
    status: "sent",
    message: "Sent. An organiser will verify it's you and update your email — check back in a bit.",
  };
}
