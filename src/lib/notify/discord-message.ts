import { EVENT, formatPeso } from "@/lib/config/event";
import { THEME } from "@/lib/config/theme";
import { HELP_CATEGORIES, type HelpCategory } from "@/lib/registrations/schema";

export type RegistrationSummary = {
  fullName: string;
  yearLevel: string;
  section: string;
  amountCentavos: number;
  gcashReference: string;
  reviewUrl: string | null;
};

type DiscordEmbed = {
  title: string;
  url?: string;
  color: number;
  fields: { name: string; value: string }[];
  footer: { text: string };
  timestamp: string;
};

type DiscordPayload = { embeds: [DiscordEmbed] };

/** Converts a "#RRGGBB" theme color to the decimal integer Discord's embed API expects. */
export function hexToDiscordColor(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

/**
 * Pure message formatting, kept in its own module (no `server-only` import)
 * so it can be unit tested without a Next.js server context. The network
 * call lives in discord.ts.
 *
 * A rich embed reads far better than a plain-text ping on a phone
 * notification — structured fields, a colored bar matching the event
 * theme, and a clickable title straight to Payments.
 *
 * Fields are stacked (no `inline`), not side by side: Discord's inline
 * layout wraps unpredictably once a name or section is long — three fields
 * fit on one row only as long as none of them are, which real data won't
 * guarantee. A single column stays legible regardless of content length,
 * and reads better on the phone-sized Discord client this is mostly seen on.
 */
export function buildRegistrationPayload(
  input: RegistrationSummary,
): DiscordPayload {
  const embed: DiscordEmbed = {
    title: "New registration waiting for review",
    color: hexToDiscordColor(THEME.colors.accent),
    fields: [
      { name: "Student", value: input.fullName },
      {
        name: "Year & Section",
        value: `${input.yearLevel} · Section ${input.section}`,
      },
      { name: "Amount", value: formatPeso(input.amountCentavos) },
      { name: "GCash reference", value: `\`${input.gcashReference}\`` },
    ],
    footer: { text: EVENT.name },
    timestamp: new Date().toISOString(),
  };

  if (input.reviewUrl) {
    embed.url = input.reviewUrl;
  }

  return { embeds: [embed] };
}

export type HelpRequestSummary = {
  studentId: string;
  fullName: string;
  category: HelpCategory;
  requestedEmail: string | null;
  message: string | null;
  /** The admin queue this request landed in, when the site URL is configured. */
  queueUrl: string | null;
};

/**
 * Sent from /find's "Report a QR problem". A different color from the
 * new-registration embed (accent2, not accent) so the two are visually
 * distinct at a glance in a channel that gets both.
 */
export function buildHelpRequestPayload(input: HelpRequestSummary): DiscordPayload {
  const fields = [{ name: "Student", value: `${input.fullName} (${input.studentId})` }];
  if (input.requestedEmail) {
    fields.push({ name: "Requested email", value: input.requestedEmail });
  }
  if (input.message) {
    fields.push({ name: "Message", value: input.message });
  }

  const embed: DiscordEmbed = {
    title: HELP_CATEGORIES[input.category],
    color: hexToDiscordColor(THEME.colors.accent2),
    fields,
    footer: { text: EVENT.name },
    timestamp: new Date().toISOString(),
  };

  if (input.queueUrl) {
    embed.url = input.queueUrl;
  }

  return { embeds: [embed] };
}
