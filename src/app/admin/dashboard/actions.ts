"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";
import { currentAdminId } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/queries";
import { getProfile } from "@/lib/profiles/queries";
import {
  getRegistration,
  markTicketEmailSent,
  pendingTicketEmailRecipients,
} from "@/lib/registrations/queries";
import {
  EMAIL_BATCH_LIMIT,
  sendTicketApprovedBatch,
  sendTicketApprovedEmail,
  sendingDomainReady,
} from "@/lib/notify/email";

export type ActionResult = { ok: boolean; error?: string };

/**
 * Frees a student's ID for a fresh submission without going through the
 * Payments page's own reject flow, which only ever sees pending rows. This
 * works on an approved row too — the whole point is covering the case
 * Payments can't: a student needs a legitimate do-over after their ticket
 * already went through.
 *
 * Rejecting is what actually unlocks the slot: the migration's partial
 * unique index on registrations(student_id) excludes rejected rows, so this
 * needs no separate "reactivation" state of its own.
 */
export async function voidRegistration(
  id: string,
  reason: string,
): Promise<ActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Give a reason the student can act on." };
  if (trimmed.length > 300) {
    return { ok: false, error: "Keep the reason under 300 characters." };
  }

  const { data, error } = await adminClient()
    .from("registrations")
    .update({
      status: "rejected",
      reject_reason: trimmed,
      ticket_code: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
    })
    .eq("id", id)
    .neq("status", "rejected")
    .select("full_name, student_id, amount");

  if (error) {
    console.error("voidRegistration failed", error);
    return { ok: false, error: "Could not void this registration. Try again." };
  }

  const voided = data?.[0];
  if (voided) {
    await logActivity({
      userId: adminId,
      activityType: "registration_voided",
      description: `Voided registration for ${voided.full_name} (${voided.student_id}): ${trimmed}`,
      registrationId: id,
      amount: voided.amount,
    });
  }

  revalidatePath("/admin/dashboard");
  return { ok: true };
}

/** Resend allows ~2 requests a second; one batch is one request. */
const BATCH_PAUSE_MS = 600;

const NO_DOMAIN_ERROR =
  "No verified sending domain yet. Set RESEND_FROM_EMAIL to an address on " +
  "your own domain and redeploy — see docs/setup/resend.md.";

/**
 * Only an admin sends mail to the whole event. The Dashboard is already
 * admin-only via admin/layout.tsx, but a server action is callable on its
 * own, and this one reaches every payee's inbox at once.
 */
async function currentAdmin(): Promise<string | null> {
  const userId = await currentAdminId();
  if (!userId) return null;
  const profile = await getProfile(userId);
  return profile?.role === "admin" ? userId : null;
}

export type SendTicketEmailsResult =
  | { ok: true; sent: number; failed: number }
  | { ok: false; error: string };

/**
 * Emails the QR to every approved payee who hasn't been sent one.
 *
 * This exists because the approval email has been failing since sales
 * opened — no verified domain, so Resend dropped every message
 * (docs/setup/resend.md). The backlog is real people holding a paid ticket
 * they've never seen. Modelled on sendEvaluationInvites(): a chunk is
 * stamped only after Resend accepts it, so pressing this again retries
 * exactly what failed and emails nobody twice.
 *
 * It refuses to run at all until the domain is live, rather than firing into
 * a sender that silently discards mail — see sendingDomainReady().
 */
export async function sendTicketEmails(): Promise<SendTicketEmailsResult> {
  const adminId = await currentAdmin();
  if (!adminId) return { ok: false, error: "Sign in as an admin again." };
  if (!sendingDomainReady()) return { ok: false, error: NO_DOMAIN_ERROR };

  const recipients = await pendingTicketEmailRecipients();
  // Null means the queue couldn't be read at all — almost always migration
  // 0009 not yet pasted into the hosted project. Say that instead of
  // reporting an empty queue, which reads as "everyone already has theirs."
  if (recipients === null) {
    return {
      ok: false,
      error:
        "Can't read who still needs emailing. Paste " +
        "supabase/migrations/0009_ticket_email.sql into Supabase first.",
    };
  }
  if (recipients.length === 0) return { ok: true, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (let start = 0; start < recipients.length; start += EMAIL_BATCH_LIMIT) {
    if (start > 0) await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));

    const chunk = recipients.slice(start, start + EMAIL_BATCH_LIMIT);
    const delivered = await sendTicketApprovedBatch(
      chunk.map((recipient) => ({
        to: recipient.email,
        fullName: recipient.fullName,
        registrationId: recipient.id,
        ticketCode: recipient.ticketCode,
      })),
    );

    if (delivered) {
      await markTicketEmailSent(chunk.map((recipient) => recipient.id));
      sent += chunk.length;
    } else {
      failed += chunk.length;
    }
  }

  if (sent > 0) {
    await logActivity({
      userId: adminId,
      activityType: "ticket_email_sent",
      description:
        `Sent ${sent} ticket QR email${sent === 1 ? "" : "s"}` +
        (failed > 0 ? ` (${failed} failed)` : ""),
    });
  }

  revalidatePath("/admin/dashboard");
  return { ok: true, sent, failed };
}

/**
 * One student's ticket, re-sent on request — the "I never got it" counter
 * to the bulk send.
 *
 * Deliberately not gated on `ticket_email_sent_at`: the whole point is that
 * it works for someone already marked as emailed, whose copy went to spam or
 * to a typo'd address they've since had corrected.
 */
export async function sendTicketEmail(id: string): Promise<ActionResult> {
  const adminId = await currentAdmin();
  if (!adminId) return { ok: false, error: "Sign in as an admin again." };
  if (!sendingDomainReady()) return { ok: false, error: NO_DOMAIN_ERROR };

  const registration = await getRegistration(id);
  if (!registration) return { ok: false, error: "Registration not found." };
  if (registration.status !== "approved" || !registration.ticket_code) {
    return { ok: false, error: "Only an approved ticket has a QR to send." };
  }

  const status = await sendTicketApprovedEmail({
    to: registration.email,
    fullName: registration.full_name,
    ticketId: registration.id,
    ticketCode: registration.ticket_code,
  });

  if (status !== "sent") {
    await logActivity({
      userId: adminId,
      activityType: "email_failed",
      description: `Ticket email to ${registration.email} failed to send for ${registration.full_name}`,
      registrationId: id,
    });
    return { ok: false, error: "Resend rejected it. Check /admin/activity." };
  }

  await markTicketEmailSent([id]);
  await logActivity({
    userId: adminId,
    activityType: "ticket_email_sent",
    description: `Sent the ticket QR to ${registration.email} for ${registration.full_name}`,
    registrationId: id,
  });

  revalidatePath("/admin/dashboard");
  return { ok: true };
}
