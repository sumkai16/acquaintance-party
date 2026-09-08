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
  /** Site-relative path of the QR image, e.g. `/ticket/<id>/qr`. */
  qrPath?: string;
  ticketCode?: string;
  attachments?: { filename: string; content: Buffer }[];
};

/**
 * "skipped" — not configured, the deliberate no-op (see below), not a
 * failure worth surfacing anywhere. "failed" — configured but Resend
 * rejected or couldn't be reached; callers that can identify who was
 * waiting on the email should log this so it doesn't fail silently forever.
 */
export type SendStatus = "sent" | "skipped" | "failed";

/**
 * Best-effort confirmation emails. Never allowed to throw or block the
 * caller, matching src/lib/notify/discord.ts — a missing key, a network
 * error, or Resend being down must never stop checkout or an approval.
 */
async function send(
  input: SendInput,
  build: (args: EmailInput) => BuiltEmail,
): Promise<SendStatus> {
  const apiKey = process.env.RESEND_API_KEY;
  // NEXT_PUBLIC_SITE_URL specifically gates sending here, not just link
  // quality: an email whose only purpose is a working link back to the
  // ticket is worse than no email if that link can't be absolute.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!apiKey || !siteUrl) return "skipped"; // Not configured — skip silently, not an error.

  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const built = build({
    fullName: input.fullName,
    url: `${siteUrl}${input.path}`,
    ...(input.qrPath ? { qrUrl: `${siteUrl}${input.qrPath}` } : {}),
    ...(input.ticketCode ? { ticketCode: input.ticketCode } : {}),
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
      return "failed";
    }
  } catch (error) {
    console.error("Resend request failed", error);
    return "failed";
  }
  return "sent";
}

type TicketInput = { to: string; fullName: string; ticketId: string };

export async function sendTicketSubmittedEmail(
  input: TicketInput,
): Promise<SendStatus> {
  return send(
    { to: input.to, fullName: input.fullName, path: `/ticket/${input.ticketId}` },
    buildTicketSubmittedEmail,
  );
}

/**
 * The ticket itself. `ticketCode` is optional only so a caller that hasn't
 * got it in hand still sends *something* — pass it whenever you can, since
 * it's what puts the QR in the email rather than one click away.
 */
export async function sendTicketApprovedEmail(
  input: TicketInput & { ticketCode?: string },
): Promise<SendStatus> {
  return send(
    {
      to: input.to,
      fullName: input.fullName,
      path: `/ticket/${input.ticketId}`,
      ...(input.ticketCode
        ? { qrPath: `/ticket/${input.ticketId}/qr`, ticketCode: input.ticketCode }
        : {}),
    },
    buildTicketApprovedEmail,
  );
}

/** Resend's per-request ceiling for a batch send. */
export const EMAIL_BATCH_LIMIT = 100;

/**
 * Whether mail sent from this deployment will actually reach a student.
 *
 * `onboarding@resend.dev` is not a working sender for anyone but the Resend
 * account's own signup address — every other recipient is dropped. That is
 * survivable for a single approval (it logs `email_failed` and an admin
 * notices), but a bulk send must not run on it: the API call can be accepted
 * while the mail goes nowhere, which would stamp hundreds of registrations
 * as emailed and quietly bury the very backlog the button exists to clear.
 *
 * So the bulk send asks this first. See docs/setup/resend.md §2.
 */
export function sendingDomainReady(): boolean {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!process.env.RESEND_API_KEY || !process.env.NEXT_PUBLIC_SITE_URL) return false;
  if (!from) return false; // Unset means the code falls back to resend.dev.
  return !/@resend\.dev>?\s*$/i.test(from.trim());
}

type BatchMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * One batch, all or nothing.
 *
 * Batched rather than sent one by one because these run inside a single
 * request: a few hundred students sent individually would either trip
 * Resend's rate limit or outlast the function. Unlike the single-message
 * senders this reports whether the call went out — the admin actions stamp
 * their "already emailed" column only on success, so a failed batch is
 * picked up by the next press of the button rather than lost.
 *
 * Attachments are deliberately absent: Resend's batch endpoint rejects them.
 * Anything an email needs to *show* has to be a hosted URL — which is why
 * the ticket QR is a route rather than a file on the message.
 */
async function deliverBatch(messages: BatchMessage[]): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || messages.length === 0) return false;

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

/** Shared setup for a batch: the configured sender and the absolute site URL. */
function batchContext(): { from: string; siteUrl: string } | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!process.env.RESEND_API_KEY || !siteUrl) return null;
  return { from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev", siteUrl };
}

/** The post-event invites, up to a hundred at a time. */
export async function sendEvaluationInviteBatch(
  recipients: { to: string; fullName: string; registrationId: string }[],
): Promise<boolean> {
  const context = batchContext();
  if (!context) return false;

  return deliverBatch(
    recipients.map((recipient) => {
      const built = buildEvaluationInviteEmail({
        fullName: recipient.fullName,
        url: `${context.siteUrl}/evaluate/${recipient.registrationId}`,
      });
      return { from: context.from, to: recipient.to, ...built };
    }),
  );
}

/**
 * The ticket QR, up to a hundred at a time — the backlog send.
 *
 * Same message the single approval sends, QR image and all; nothing about it
 * says "this is late," because from the student's side it is simply their
 * ticket arriving.
 */
export async function sendTicketApprovedBatch(
  recipients: {
    to: string;
    fullName: string;
    registrationId: string;
    ticketCode: string;
  }[],
): Promise<boolean> {
  const context = batchContext();
  if (!context) return false;

  return deliverBatch(
    recipients.map((recipient) => {
      const built = buildTicketApprovedEmail({
        fullName: recipient.fullName,
        url: `${context.siteUrl}/ticket/${recipient.registrationId}`,
        qrUrl: `${context.siteUrl}/ticket/${recipient.registrationId}/qr`,
        ticketCode: recipient.ticketCode,
      });
      return { from: context.from, to: recipient.to, ...built };
    }),
  );
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
