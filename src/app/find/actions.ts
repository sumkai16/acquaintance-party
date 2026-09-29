"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { HELP_CATEGORIES, helpRequestSchema, normalizeStudentId } from "@/lib/registrations/schema";
import { emailDomainProblem } from "@/lib/registrations/mx";
import { isThrottled, throttleWindowStart } from "@/lib/registrations/abuse";
import { findOwnRegistration, findRegistrationByStudentId } from "@/lib/registrations/queries";
import { notifyHelpRequest } from "@/lib/notify/discord";
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
   * "no_match" specifically (not just any error) is what opens the
   * "report a QR problem" form on "wrong email" — see find-form.tsx.
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

export type HelpState = {
  status: "idle" | "error" | "sent";
  message?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Never changes anything itself — anyone could type any student ID here,
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
  "You've sent several requests already. Wait a moment, or message " +
  "an organiser directly.";

export async function requestHelp(
  _prev: HelpState,
  formData: FormData,
): Promise<HelpState> {
  const parsed = helpRequestSchema.safeParse({
    studentId: String(formData.get("studentId") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    category: String(formData.get("category") ?? ""),
    requestedEmail: String(formData.get("requestedEmail") ?? ""),
    message: String(formData.get("message") ?? ""),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      fieldErrors[field] ??= issue.message;
    }
    return { status: "error", message: "Check the highlighted fields.", fieldErrors };
  }

  const { studentId, fullName, category, requestedEmail, message } = parsed.data;

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
  const domainProblem = requestedEmail ? await emailDomainProblem(requestedEmail) : null;
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
    requestedEmail ? countRecentEmailFixRequestsByEmail(requestedEmail, since) : 0,
  ]);
  if (isThrottled(recentById) || isThrottled(recentByEmail)) {
    return { status: "error", message: throttledMessage };
  }

  await Promise.all([
    createEmailFixRequest({
      studentId,
      fullName,
      category,
      requestedEmail: requestedEmail ?? null,
      message: message ?? null,
      registrationId: registration.id,
    }),
    logActivity({
      userId: null,
      // Wrong-email reports keep their original type so existing
      // /admin/activity filters still find them.
      activityType: category === "wrong_email" ? "email_correction_requested" : "help_requested",
      description:
        category === "wrong_email"
          ? `${fullName} (${studentId}) says the email on file is wrong and asks for it to be ` +
            `changed to ${requestedEmail}.`
          : `${fullName} (${studentId}) reported: ${HELP_CATEGORIES[category]}.` +
            (message ? ` "${message}"` : ""),
      registrationId: registration.id,
    }),
  ]);

  after(async () => {
    await notifyHelpRequest({
      studentId,
      fullName,
      category,
      requestedEmail: requestedEmail ?? null,
      message: message ?? null,
    });
  });

  return {
    status: "sent",
    message:
      category === "wrong_email"
        ? "Sent. An organiser will verify it's you and update your email — check back in a bit."
        : "Sent. An organiser will look into it — check your ticket page again in a bit.",
  };
}
