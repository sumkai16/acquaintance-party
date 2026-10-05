"use server";

import { revalidatePath } from "next/cache";
import { summarizeWrittenAnswers, type AiSummaryResult } from "@/lib/evaluation/ai-summary";
import {
  evaluationSummary,
  markInvited,
  pendingInviteRecipients,
} from "@/lib/evaluation/queries";
import {
  EMAIL_BATCH_LIMIT,
  sendEvaluationInviteBatch,
} from "@/lib/notify/email";
import { ADMIN_ONLY_ERROR, requireAdmin } from "@/lib/auth/require-admin";

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
  if (!(await requireAdmin())) return { ok: false, error: ADMIN_ONLY_ERROR };

  const recipients = await pendingInviteRecipients();
  if (recipients.length === 0) return { ok: true, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (let start = 0; start < recipients.length; start += EMAIL_BATCH_LIMIT) {
    const chunk = recipients.slice(start, start + EMAIL_BATCH_LIMIT);
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

/**
 * An AI reading of one written question. The answers are read here, from the
 * database, never taken from the browser, so the button can only ever send
 * what the evaluation already holds. Nothing is stored: a click costs a few
 * cents and the result lives on the page until it is refreshed.
 *
 * Which model answered is private to whoever runs the site locally: the name is
 * dropped here, on the server, unless SHOW_AI_MODEL=1, so on the deployed site
 * it is never sent to anyone's browser, admins included.
 */
export async function summarizeQuestion(questionId: string): Promise<AiSummaryResult> {
  if (!(await requireAdmin())) return { ok: false, error: ADMIN_ONLY_ERROR };

  const summary = await evaluationSummary();
  for (const section of summary.sections) {
    for (const question of section.questions) {
      if (question.id === questionId && question.kind === "text") {
        const result = await summarizeWrittenAnswers(question.prompt, question.responses);
        if (result.ok && process.env.SHOW_AI_MODEL !== "1") {
          return { ok: true, summary: { ...result.summary, model: null } };
        }
        return result;
      }
    }
  }
  return { ok: false, error: "That question has no written answers." };
}
