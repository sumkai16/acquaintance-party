"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { emailFixRequestSchema, normalizeStudentId } from "@/lib/registrations/schema";
import { emailDomainProblem } from "@/lib/registrations/mx";
import { isThrottled, throttleWindowStart } from "@/lib/registrations/abuse";
import { findOwnRegistration, findRegistrationByStudentId } from "@/lib/registrations/queries";
import { notifyEmailCorrectionRequest } from "@/lib/notify/discord";
import { logActivity } from "@/lib/activity/queries";
import {
  countRecentEmailFixRequests,
  countRecentEmailFixRequestsByEmail,
  createEmailFixRequest,
} from "@/lib/email-fixes/queries";

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
 * writes to email_correction_requests, the queue /admin/email-fixes works
 * through, and to activity_logs alongside it (the generic system record
 * every action leaves, same as ticket_email_sent or payment_approved), and
 * best-effort pings Discord for immediate visibility, same as a new
 * registration does.
 */
const noRegistrationMessage =
  "We couldn't find any registration with that student ID. Double-check it, " +
  "or message an organiser if you haven't registered yet.";

const throttledMessage =
  "You've requested a fix several times already. Wait a moment, or message " +
  "an organiser directly.";

export async function requestEmailCorrection(
  _prev: EmailFixState,
  formData: FormData,
): Promise<EmailFixState> {
  const parsed = emailFixRequestSchema.safeParse({
    studentId: String(formData.get("studentId") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    requestedEmail: String(formData.get("requestedEmail") ?? ""),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      fieldErrors[field] ??= issue.message;
    }
    return { status: "error", message: "Check the highlighted fields.", fieldErrors };
  }

  const { studentId, fullName, requestedEmail } = parsed.data;

  // Checked before anything else, and cheap (one indexed read) — a request
  // for a student ID with no registration at all can't be acted on by
  // staff no matter what, so it shouldn't reach a DNS lookup, the throttle,
  // activity_logs, or Discord. This is also most of what keeps the queue
  // from filling with noise: a bogus ID stops here, for free.
  const registration = await findRegistrationByStudentId(studentId);
  if (!registration) {
    return {
      status: "error",
      message: noRegistrationMessage,
      fieldErrors: { studentId: noRegistrationMessage },
    };
  }

  // Same check checkout/walk-in/edit already run: a well-formed address
  // whose domain has no mail server would just bounce again once staff
  // applies the "fix" — exactly the failure mode this form exists to close.
  const domainProblem = await emailDomainProblem(requestedEmail);
  if (domainProblem) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: { requestedEmail: domainProblem },
    };
  }

  // Two keys, not one: a student ID throttle alone lets someone cycle
  // through several IDs (typos, guesses, someone else's) while aiming at
  // the same inbox every time — that address is the throttle the ID-based
  // one can't see.
  const since = throttleWindowStart(new Date());
  const [recentById, recentByEmail] = await Promise.all([
    countRecentEmailFixRequests(studentId, since),
    countRecentEmailFixRequestsByEmail(requestedEmail, since),
  ]);
  if (isThrottled(recentById) || isThrottled(recentByEmail)) {
    return { status: "error", message: throttledMessage };
  }

  await Promise.all([
    createEmailFixRequest({
      studentId,
      fullName,
      requestedEmail,
      registrationId: registration.id,
    }),
    logActivity({
      userId: null,
      activityType: "email_correction_requested",
      description:
        `${fullName} (${studentId}) says the email on file is wrong and asks for it to be ` +
        `changed to ${requestedEmail}.`,
      registrationId: registration.id,
    }),
  ]);

  after(async () => {
    await notifyEmailCorrectionRequest({ studentId, fullName, requestedEmail });
  });

  return {
    status: "sent",
    message: "Sent. An organiser will verify it's you and update your email — check back in a bit.",
  };
}
