"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ONLY_ERROR, requireAdmin } from "@/lib/auth/require-admin";
import { replyToHelpRequest, resolveEmailFixRequest } from "@/lib/email-fixes/queries";
import { getRegistration } from "@/lib/registrations/queries";
import { sendHelpReplyEmail, type SendStatus } from "@/lib/notify/email";
import { logActivity } from "@/lib/activity/queries";

const REPLY_MAX = 1000;

export type ActionResult = { ok: boolean; error?: string };

/**
 * Bookkeeping only — the actual fix happens on the Dashboard's edit flow,
 * which is requireAdmin()-gated and not in staff's nav at all. Matching that
 * here rather than defaulting to Walk-in's staff-open access level, since a
 * "resolved" queue whose fix step staff can't reach would be confusing, not
 * convenient.
 */
export async function resolveEmailFix(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: ADMIN_ONLY_ERROR };

  const result = await resolveEmailFixRequest(id, admin.id);
  if (!result.ok) return result;

  revalidatePath("/admin/email-fixes");
  return { ok: true };
}

export type ReplyResult =
  | { ok: true; emailStatus: SendStatus | "no_registration" }
  | { ok: false; error: string };

/**
 * Saves the reply first, then emails it: the ticket page is the copy the
 * student can always reach, so a failed email still leaves them answered.
 * The email only ever goes to the address on the registration — never the
 * unverified address a wrong-email report asks for.
 */
export async function replyToHelp(id: string, rawReply: string): Promise<ReplyResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: ADMIN_ONLY_ERROR };

  const reply = rawReply.trim();
  if (!reply) return { ok: false, error: "Write a reply first." };
  if (reply.length > REPLY_MAX) {
    return { ok: false, error: `Keep the reply under ${REPLY_MAX} characters.` };
  }

  const saved = await replyToHelpRequest(id, reply, admin.id);
  if (!saved.ok) return saved;

  const { request } = saved;
  const registration = request.registration_id
    ? await getRegistration(request.registration_id)
    : null;

  const emailStatus = registration
    ? await sendHelpReplyEmail({
        to: registration.email,
        fullName: registration.full_name,
        ticketId: registration.id,
        reply,
      })
    : "no_registration";

  await logActivity({
    userId: admin.id,
    activityType: "help_replied",
    description:
      `Replied to ${request.full_name} (${request.student_id}): "${reply}"` +
      (emailStatus === "sent"
        ? ` — emailed to ${registration?.email}.`
        : emailStatus === "failed"
          ? " — the email failed; it's on their ticket page."
          : emailStatus === "no_registration"
            ? " — no matching registration, so it wasn't delivered anywhere."
            : " — email not configured; it's on their ticket page."),
    registrationId: registration?.id,
  });

  revalidatePath("/admin/email-fixes");
  if (registration) revalidatePath(`/ticket/${registration.id}`);
  return { ok: true, emailStatus };
}
