import { EVENT } from "@/lib/config/event";

export type TicketEmailInput = {
  fullName: string;
  ticketUrl: string;
};

export type BuiltEmail = {
  subject: string;
  html: string;
  text: string;
};

/**
 * Pure message formatting, kept in its own module (no `server-only` import)
 * so it can be unit tested without a Next.js server context — the same split
 * `src/lib/notify/discord-message.ts` uses. The network call lives in
 * `email.ts`.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(bodyHtml: string): string {
  return `<div style="font-family:sans-serif;font-size:16px;line-height:1.5;color:#2E1D16">${bodyHtml}</div>`;
}

/**
 * Sent right after checkout. This is the student's only copy of the ticket
 * link outside the browser tab they're sitting in — it must not imply the
 * ticket is already valid, since review is manual and can take a while.
 */
export function buildTicketSubmittedEmail(
  input: TicketEmailInput,
): BuiltEmail {
  const name = escapeHtml(input.fullName);

  return {
    subject: `Your ${EVENT.name} ticket — check your payment status`,
    html: wrap(
      `<p>Hi ${name},</p>` +
        `<p>We received your ${EVENT.name} registration. We check every ` +
        `payment by hand, so this isn't your ticket yet — it's the link ` +
        `where you'll find it once an organiser reviews your receipt.</p>` +
        `<p><a href="${input.ticketUrl}">${input.ticketUrl}</a></p>` +
        `<p>Bookmark that link. It updates on its own once it's reviewed.</p>`,
    ),
    text:
      `Hi ${input.fullName},\n\n` +
      `We received your ${EVENT.name} registration. We check every payment ` +
      `by hand, so this isn't your ticket yet — it's the link where you'll ` +
      `find it once an organiser reviews your receipt.\n\n` +
      `${input.ticketUrl}\n\n` +
      `Bookmark that link. It updates on its own once it's reviewed.`,
  };
}

/** Sent the moment an admin approves a registration. */
export function buildTicketApprovedEmail(input: TicketEmailInput): BuiltEmail {
  const name = escapeHtml(input.fullName);

  return {
    subject: `Your ${EVENT.name} ticket is approved`,
    html: wrap(
      `<p>Hi ${name},</p>` +
        `<p>Your ${EVENT.name} ticket is approved. Your QR code is ready at ` +
        `the link below — screenshot it or keep the page bookmarked.</p>` +
        `<p><a href="${input.ticketUrl}">${input.ticketUrl}</a></p>`,
    ),
    text:
      `Hi ${input.fullName},\n\n` +
      `Your ${EVENT.name} ticket is approved. Your QR code is ready at the ` +
      `link below — screenshot it or keep the page bookmarked.\n\n` +
      `${input.ticketUrl}`,
  };
}
