import "server-only";
import { Resend } from "resend";
import {
  buildCertificateEmail,
  buildEvaluationInviteEmail,
  buildTicketApprovedEmail,
  buildTicketSubmittedEmail,
  type BuiltEmail,
  type EmailInput,
} from "./email-message";

type SendInput = {
  to: string;
  fullName: string;
  /** Site-relative path the email's button points at, e.g. `/ticket/<id>`. */
  path: string;
  attachments?: { filename: string; content: Buffer }[];
};

/**
 * Best-effort confirmation emails. Never allowed to throw or block the
 * caller, matching src/lib/notify/discord.ts — a missing key, a network
 * error, or Resend being down must never stop checkout or an approval.
 */
async function send(
  input: SendInput,
  build: (args: EmailInput) => BuiltEmail,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  // NEXT_PUBLIC_SITE_URL specifically gates sending here, not just link
  // quality: an email whose only purpose is a working link back to the
  // ticket is worse than no email if that link can't be absolute.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!apiKey || !siteUrl) return; // Not configured — skip silently, not an error.

  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const built = build({
    fullName: input.fullName,
    url: `${siteUrl}${input.path}`,
  });

  try {
    const result = await new Resend(apiKey).emails.send({
      from,
      to: input.to,
      subject: built.subject,
      html: built.html,
      text: built.text,
      ...(input.attachments ? { attachments: input.attachments } : {}),
    });
    if (result.error) {
      console.error("Resend responded with an error", result.error);
    }
  } catch (error) {
    console.error("Resend request failed", error);
  }
}

type TicketInput = { to: string; fullName: string; ticketId: string };

export async function sendTicketSubmittedEmail(
  input: TicketInput,
): Promise<void> {
  await send(
    { to: input.to, fullName: input.fullName, path: `/ticket/${input.ticketId}` },
    buildTicketSubmittedEmail,
  );
}

export async function sendTicketApprovedEmail(
  input: TicketInput,
): Promise<void> {
  await send(
    { to: input.to, fullName: input.fullName, path: `/ticket/${input.ticketId}` },
    buildTicketApprovedEmail,
  );
}

/** Resend's per-request ceiling for a batch send. */
export const INVITE_BATCH_LIMIT = 100;

/**
 * The post-event invites, up to a hundred at a time.
 *
 * Batched rather than sent one by one because this runs inside a single
 * request: a few hundred attendees sent individually would either trip
 * Resend's rate limit or outlast the function. Unlike the other senders this
 * reports whether the call went out — the admin action stamps
 * `evaluation_invited_at` only on success, so a failed batch is picked up by
 * the next press of the button rather than lost.
 */
export async function sendEvaluationInviteBatch(
  recipients: { to: string; fullName: string; registrationId: string }[],
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!apiKey || !siteUrl || recipients.length === 0) return false;

  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const messages = recipients.map((recipient) => {
    const built = buildEvaluationInviteEmail({
      fullName: recipient.fullName,
      url: `${siteUrl}/evaluate/${recipient.registrationId}`,
    });
    return {
      from,
      to: recipient.to,
      subject: built.subject,
      html: built.html,
      text: built.text,
    };
  });

  try {
    const result = await new Resend(apiKey).batch.send(messages);
    if (result.error) {
      console.error("Resend batch responded with an error", result.error);
      return false;
    }
  } catch (error) {
    console.error("Resend batch request failed", error);
    return false;
  }

  return true;
}

export async function sendCertificateEmail(input: {
  to: string;
  fullName: string;
  registrationId: string;
  pdf: Buffer;
  filename: string;
}): Promise<void> {
  await send(
    {
      to: input.to,
      fullName: input.fullName,
      path: `/certificate/${input.registrationId}`,
      attachments: [{ filename: input.filename, content: input.pdf }],
    },
    buildCertificateEmail,
  );
}
