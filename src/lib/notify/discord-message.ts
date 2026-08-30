import { formatPeso } from "@/lib/config/event";

export type RegistrationSummary = {
  fullName: string;
  yearLevel: string;
  section: string;
  amountCentavos: number;
  reviewUrl: string | null;
};

/**
 * Pure message formatting, kept in its own module (no `server-only` import)
 * so it can be unit tested without a Next.js server context. The network
 * call lives in discord.ts.
 */
export function buildRegistrationMessage(input: RegistrationSummary): string {
  const lines = [
    "New registration waiting for review",
    `${input.fullName} — ${input.yearLevel}, Section ${input.section} — ${formatPeso(input.amountCentavos)}`,
  ];
  if (input.reviewUrl) lines.push(input.reviewUrl);
  return lines.join("\n");
}
