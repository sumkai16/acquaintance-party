"use server";

import { revalidatePath } from "next/cache";
import { markInvited, pendingInviteRecipients } from "@/lib/evaluation/queries";
import {
  INVITE_BATCH_LIMIT,
  sendEvaluationInviteBatch,
} from "@/lib/notify/email";
import { currentAdminId } from "@/lib/supabase/server";

export type SendResult =
  | { ok: true; sent: number; failed: number }
  | { ok: false; error: string };

/**
 * Emails the evaluation link to everyone scanned in at the door who hasn't
 * had it yet.
 *
 * Safe to press again: recipients are chosen by `evaluation_invited_at is
 * null`, and a chunk is stamped only after Resend accepts it, so a second
 * press retries what failed and catches attendees whose door scan synced late
 * — without emailing anyone twice.
 */
export async function sendEvaluationInvites(): Promise<SendResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const recipients = await pendingInviteRecipients();
  if (recipients.length === 0) return { ok: true, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (let start = 0; start < recipients.length; start += INVITE_BATCH_LIMIT) {
    const chunk = recipients.slice(start, start + INVITE_BATCH_LIMIT);
    const delivered = await sendEvaluationInviteBatch(
      chunk.map((recipient) => ({
        to: recipient.email,
        fullName: recipient.fullName,
        registrationId: recipient.id,
      })),
    );

    if (delivered) {
      await markInvited(chunk.map((recipient) => recipient.id));
      sent += chunk.length;
    } else {
      failed += chunk.length;
    }
  }

  revalidatePath("/admin/evaluations");
  return { ok: true, sent, failed };
}
