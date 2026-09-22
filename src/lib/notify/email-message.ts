import { EVENT, formatPeso } from "@/lib/config/event";
import { THEME } from "@/lib/config/theme";
import { formatTicketCode } from "@/lib/tickets/code";

export type EmailInput = {
  fullName: string;
  /** Absolute URL the email's button points at. */
  url: string;
  /**
   * Absolute URL of the hosted ticket QR PNG. Optional: without it the
   * approval email is exactly the link-only message it has always been,
   * which is what an unconfigured `NEXT_PUBLIC_SITE_URL` leaves us with.
   */
  qrUrl?: string;
  /**
   * When set, the QR image is a `cid:` reference to an inline attachment
   * the caller adds to the message (see src/lib/notify/email.ts), rather
   * than the hosted `qrUrl` above. `qrUrl` is still needed regardless — a
   * batch send (which cannot carry attachments) always falls back to it.
   */
  qrCid?: string;
  /** The bare 12-character code, printed under the QR. */
  ticketCode?: string;
  /** Centavos already collected — only set for the partial walk-in email. */
  paidCentavos?: number;
  /** Centavos still owed — only set for the partial walk-in email. */
  owedCentavos?: number;
  /** Absolute URLs of the acknowledgement receipts this email carries, oldest first. */
  receiptUrls?: string[];
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
export function buildTicketSubmittedEmail(input: EmailInput): BuiltEmail {
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
      input.url,
    ),
    text:
      `Hi ${input.fullName},\n\n` +
      `We received your ${EVENT.name} registration. We check every payment ` +
      `by hand, so this isn't your ticket yet — it's the link where you'll ` +
      `find it once an organiser reviews your receipt.\n\n` +
      `${input.url}\n\n` +
      `Bookmark that link. It updates on its own once it's reviewed.`,
  };
}

/**
 * The QR itself, on plain white, with the code in text underneath.
 *
 * `cid` (a Resend inline attachment, set for single sends — see email.ts)
 * is preferred over the hosted `qrUrl` because "the QR is blank in Gmail"
 * traces back to Gmail's image proxy stalling or being blocked on the
 * remote `<img>`; a `cid:` attachment needs no fetch at all. Resend's
 * batch endpoint — the only way to email hundreds of students in one
 * request — refuses attachments outright, so a batch send has no `cid` and
 * falls back to the hosted URL as before. Mail clients that block even
 * inline images show the code and the ticket link instead, which is why
 * neither is optional.
 *
 * The white block is the same door constraint the ticket page carries
 * (see src/lib/tickets/qr.ts): a phone camera needs black on white, so
 * this never picks up the theme even though everything around it does.
 */
function qrBlock(qrUrl: string, ticketCode?: string, cid?: string): string {
  const src = cid ? `cid:${cid}` : qrUrl;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#ffffff;border:1px solid ${ink}22;border-radius:8px">` +
    `<tr><td align="center" style="padding:20px">` +
    `<img src="${src}" width="240" height="240" alt="Your ticket QR code" style="display:block;width:240px;height:240px;border:0" />` +
    (ticketCode
      ? `<div style="margin-top:12px;font-family:'Courier New',Courier,monospace;font-size:15px;letter-spacing:0.15em;color:${ink}cc">${escapeHtml(formatTicketCode(ticketCode))}</div>`
      : "") +
    `</td></tr></table>`
  );
}

/**
 * "View your receipt" link(s), one per payment. A partial walk-in that has
 * since been paid in full has two, so they're numbered only when there's
 * more than one.
 */
function receiptLinksHtml(urls: string[] | undefined): string {
  if (!urls || urls.length === 0) return "";
  const links = urls
    .map(
      (url, index) =>
        `<a href="${url}" style="color:${accent};font-weight:700">View your receipt${urls.length > 1 ? ` ${index + 1}` : ""}</a>`,
    )
    .join("<br />");
  return `<p style="margin:16px 0 0">Proof of payment: ${urls.length > 1 ? "<br />" : ""}${links}</p>`;
}

function receiptLinksText(urls: string[] | undefined): string {
  if (!urls || urls.length === 0) return "";
  return `\n\nYour receipt${urls.length > 1 ? "s" : ""}:\n${urls.join("\n")}`;
}

/** Sent the moment an admin approves a registration. */
export function buildTicketApprovedEmail(input: EmailInput): BuiltEmail {
  const name = escapeHtml(input.fullName);
  const hasQr = Boolean(input.qrUrl);

  return {
    subject: `Your ${EVENT.name} ticket is approved`,
    html: wrap(
      `<p style="margin:0 0 16px">Hi ${name},</p>` +
        (hasQr
          ? `<p style="margin:0">Your ${escapeHtml(EVENT.name)} ticket is approved. ` +
            `Here is your QR code — screenshot it, or open the link below at ` +
            `the door.</p>` +
            qrBlock(input.qrUrl!, input.ticketCode, input.qrCid)
          : `<p style="margin:0">Your ${escapeHtml(EVENT.name)} ticket is approved. Your QR ` +
            `code is ready at the link below — screenshot it or keep the page ` +
            `bookmarked for the door.</p>`) +
        receiptLinksHtml(input.receiptUrls),
      "View your QR ticket",
      input.url,
    ),
    text:
      `Hi ${input.fullName},\n\n` +
      `Your ${EVENT.name} ticket is approved. Your QR code is ready at the ` +
      `link below — screenshot it or keep the page bookmarked.\n\n` +
      (input.ticketCode
        ? `Ticket code: ${formatTicketCode(input.ticketCode)}\n\n`
        : "") +
      `${input.url}` +
      receiptLinksText(input.receiptUrls),
  };
}

/**
 * The backlog send — a receipt that should have reached them already, plus
 * their QR if the ticket is paid in full. Says sorry up front: for most of
 * these students the payment went through days ago with nothing in writing.
 */
export function buildReceiptBacklogEmail(input: EmailInput): BuiltEmail {
  const name = escapeHtml(input.fullName);
  const hasQr = Boolean(input.qrUrl);

  return {
    subject: `Your ${EVENT.name} receipt — sorry for the wait`,
    html: wrap(
      `<p style="margin:0 0 16px">Hi ${name},</p>` +
        `<p style="margin:0 0 16px">Sorry this took a while. Here's the receipt for ` +
        `your ${escapeHtml(EVENT.name)} payment — keep it as your proof of payment.</p>` +
        (hasQr
          ? `<p style="margin:0">Your ticket is paid in full. Here's your QR code again ` +
            `for the door, in case you need it.</p>` +
            qrBlock(input.qrUrl!, input.ticketCode)
          : `<p style="margin:0">Your QR code comes once your ticket is paid in full.</p>`) +
        receiptLinksHtml(input.receiptUrls),
      hasQr ? "View your QR ticket" : "View your payment status",
      input.url,
    ),
    text:
      `Hi ${input.fullName},\n\n` +
      `Sorry this took a while. Here's the receipt for your ${EVENT.name} ` +
      `payment — keep it as your proof of payment.` +
      receiptLinksText(input.receiptUrls) +
      "\n\n" +
      (hasQr
        ? `Your ticket is paid in full. Your QR code:\n` +
          (input.ticketCode ? `Ticket code: ${formatTicketCode(input.ticketCode)}\n` : "")
        : `Your QR code comes once your ticket is paid in full.\n`) +
      `${input.url}`,
  };
}

/**
 * Sent after the party, to everyone who was scanned in at the door.
 *
 * The certificate is the reason to open it, so it leads with that rather than
 * with the survey — and it says plainly that the evaluation comes first, so
 * nobody clicks expecting a download and feels ambushed by a form.
 */
export function buildEvaluationInviteEmail(input: EmailInput): BuiltEmail {
  const name = escapeHtml(input.fullName);

  return {
    subject: `How was ${EVENT.name}? Your certificate is waiting`,
    html: wrap(
      `<p style="margin:0 0 16px">Hi ${name},</p>` +
        `<p style="margin:0 0 16px">Thanks for coming to ${escapeHtml(EVENT.name)}. ` +
        `Tell us how it went — it's a short evaluation, and it genuinely shapes ` +
        `the next one.</p>` +
        `<p style="margin:0">Once you've sent it, your certificate of attendance ` +
        `is ready to download on the spot.</p>`,
      "Evaluate and get your certificate",
      input.url,
    ),
    text:
      `Hi ${input.fullName},\n\n` +
      `Thanks for coming to ${EVENT.name}. Tell us how it went — it's a short ` +
      `evaluation, and it genuinely shapes the next one. Once you've sent it, ` +
      `your certificate of attendance is ready to download on the spot.\n\n` +
      `${input.url}`,
  };
}

/**
 * Sent the moment a walk-in cash sale is recorded as partially paid. There's no
 * QR yet — this exists to give the student a written record of what they
 * paid and what's left, since a walk-in sale otherwise leaves them with
 * nothing but a memory of handing over cash.
 */
export function buildPartialPaymentEmail(input: EmailInput): BuiltEmail {
  const name = escapeHtml(input.fullName);
  const paid = formatPeso(input.paidCentavos ?? 0);
  const owed = formatPeso(input.owedCentavos ?? 0);

  return {
    subject: `Your ${EVENT.name} payment — ${owed} still due`,
    html: wrap(
      `<p style="margin:0 0 16px">Hi ${name},</p>` +
        `<p style="margin:0 0 16px">We've recorded ${paid} toward your ${escapeHtml(EVENT.name)} ` +
        `ticket. ${owed} is still owed — your QR code is held until it's paid in ` +
        `full, so hang on to this page and pay the rest at the walk-in table.</p>` +
        `<p style="margin:0">We'll email your QR the moment the balance is settled.</p>` +
        receiptLinksHtml(input.receiptUrls),
      "View your payment status",
      input.url,
    ),
    text:
      `Hi ${input.fullName},\n\n` +
      `We've recorded ${paid} toward your ${EVENT.name} ticket. ${owed} is ` +
      `still owed — your QR code is held until it's paid in full. Pay the ` +
      `rest at the walk-in table, and we'll email your QR once it's settled.\n\n` +
      `${input.url}` +
      receiptLinksText(input.receiptUrls),
  };
}

/** Sent once the evaluation is in, with the certificate PDF attached. */
export function buildCertificateEmail(input: EmailInput): BuiltEmail {
  const name = escapeHtml(input.fullName);

  return {
    subject: `Your ${EVENT.name} certificate of attendance`,
    html: wrap(
      `<p style="margin:0 0 16px">Hi ${name},</p>` +
        `<p style="margin:0 0 16px">Thanks for the evaluation. Your certificate ` +
        `of attendance is attached to this email as a PDF.</p>` +
        `<p style="margin:0">You can also view it, or download it as an image, ` +
        `at the link below — it stays put, so come back any time.</p>`,
      "View your certificate",
      input.url,
    ),
    text:
      `Hi ${input.fullName},\n\n` +
      `Thanks for the evaluation. Your certificate of attendance is attached ` +
      `to this email as a PDF. You can also view it, or download it as an ` +
      `image, at the link below.\n\n` +
      `${input.url}`,
  };
}
