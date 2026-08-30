import { EVENT, formatPeso } from "@/lib/config/event";
import { THEME } from "@/lib/config/theme";

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
  fields: { name: string; value: string; inline?: boolean }[];
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
 * theme, and a clickable title straight to the review queue.
 */
export function buildRegistrationPayload(
  input: RegistrationSummary,
): DiscordPayload {
  const embed: DiscordEmbed = {
    title: "New registration waiting for review",
    color: hexToDiscordColor(THEME.colors.accent),
    fields: [
      { name: "Student", value: input.fullName, inline: true },
      {
        name: "Year & Section",
        value: `${input.yearLevel} · Section ${input.section}`,
        inline: true,
      },
      { name: "Amount", value: formatPeso(input.amountCentavos), inline: true },
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
