import { EVENT } from "@/lib/config/event";
import { THEME } from "@/lib/config/theme";

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

/**
 * Hex literals here are deliberate, not a violation of "read the token" —
 * `context/DESIGN.md` §0's rule is about Tailwind-rendered UI, where a CSS
 * custom property is always available. Email HTML has no such guarantee
 * (Outlook desktop in particular won't resolve `var(...)`), so the values
 * are read from `THEME.colors` once here — the single source of truth stays
 * intact — and inlined as literal hex in the templates below, which is the
 * only approach that reliably renders across mail clients.
 */
const { accent, accent2, deep, ink } = THEME.colors;

/**
 * A themed shell around one message's content. Table-based layout, all
 * styles inline — the two things that keep an email looking the same in
 * Gmail, Apple Mail, and Outlook, none of which reliably support a `<style>`
 * block or modern CSS.
 */
function wrap(bodyHtml: string, ctaLabel: string, ctaUrl: string): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2e3cb;padding:32px 16px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">` +
    // Header band — the poster feel, in an email-safe fallback font since
    // Anton itself can't be relied on to load in a mail client.
    `<tr><td style="background:${deep};padding:28px 32px;text-align:center">` +
    `<span style="display:block;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#ffffffb3">${escapeHtml(EVENT.host)} presents</span>` +
    `<span style="display:block;margin-top:8px;font-size:26px;font-weight:800;letter-spacing:0.03em;text-transform:uppercase;color:${accent2}">${escapeHtml(EVENT.name)}</span>` +
    `</td></tr>` +
    // Body
    `<tr><td style="padding:32px;font-size:16px;line-height:1.6;color:${ink}">` +
    bodyHtml +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td style="border-radius:6px;background:${accent}">` +
    `<a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#ffffff;text-decoration:none">${escapeHtml(ctaLabel)}</a>` +
    `</td></tr></table>` +
    `<p style="margin-top:16px;font-size:13px;color:${ink}99;word-break:break-all">Or copy this link: <a href="${ctaUrl}" style="color:${accent}">${ctaUrl}</a></p>` +
    `</td></tr>` +
    `</table>` +
    `</td></tr>` +
    `</table>`
  );
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
      `<p style="margin:0 0 16px">Hi ${name},</p>` +
        `<p style="margin:0 0 16px">We received your ${escapeHtml(EVENT.name)} registration. ` +
        `We check every payment by hand, so this isn't your ticket yet — it's ` +
        `the link where you'll find it once an organiser reviews your receipt.</p>` +
        `<p style="margin:0">Bookmark it. It updates on its own once it's reviewed, ` +
        `and we'll email you again the moment it is.</p>`,
      "View your ticket status",
      input.ticketUrl,
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
      `<p style="margin:0 0 16px">Hi ${name},</p>` +
        `<p style="margin:0">Your ${escapeHtml(EVENT.name)} ticket is approved. Your QR ` +
        `code is ready at the link below — screenshot it or keep the page ` +
        `bookmarked for the door.</p>`,
      "View your QR ticket",
      input.ticketUrl,
    ),
    text:
      `Hi ${input.fullName},\n\n` +
      `Your ${EVENT.name} ticket is approved. Your QR code is ready at the ` +
      `link below — screenshot it or keep the page bookmarked.\n\n` +
      `${input.ticketUrl}`,
  };
}
