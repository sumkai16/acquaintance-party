import "server-only";
import { Resend } from "resend";
import {
  buildTicketApprovedEmail,
  buildTicketSubmittedEmail,
  type BuiltEmail,
} from "./email-message";

type SendInput = { to: string; fullName: string; ticketId: string };

/**
 * Best-effort confirmation emails. Never allowed to throw or block the
 * caller, matching src/lib/notify/discord.ts — a missing key, a network
 * error, or Resend being down must never stop checkout or an approval.
 */
async function send(
  input: SendInput,
  build: (args: { fullName: string; ticketUrl: string }) => BuiltEmail,
) {
  const apiKey = process.env.RESEND_API_KEY;
  // NEXT_PUBLIC_SITE_URL specifically gates sending here, not just link
  // quality: an email whose only purpose is a working link back to the
  // ticket is worse than no email if that link can't be absolute.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!apiKey || !siteUrl) return; // Not configured — skip silently, not an error.

  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const built = build({
    fullName: input.fullName,
    ticketUrl: `${siteUrl}/ticket/${input.ticketId}`,
  });

  try {
    const result = await new Resend(apiKey).emails.send({
      from,
      to: input.to,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });
    if (result.error) {
      console.error("Resend responded with an error", result.error);
    }
  } catch (error) {
    console.error("Resend request failed", error);
  }
}

export async function sendTicketSubmittedEmail(input: SendInput): Promise<void> {
  await send(input, buildTicketSubmittedEmail);
}

export async function sendTicketApprovedEmail(input: SendInput): Promise<void> {
  await send(input, buildTicketApprovedEmail);
}
