import "server-only";
import { buildRegistrationPayload, type RegistrationSummary } from "./discord-message";

/**
 * Best-effort Discord ping when a new registration needs review.
 *
 * Never allowed to throw or block the caller: an unconfigured webhook, a
 * network error, or Discord being down must never stop a student from
 * getting their submission queued for review. Every failure is logged, not
 * propagated.
 */
export async function notifyNewRegistration(
  registration: Omit<RegistrationSummary, "reviewUrl">,
): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return; // Not configured — skip silently, not an error.

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const reviewUrl = siteUrl ? `${siteUrl}/admin/review` : null;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRegistrationPayload({ ...registration, reviewUrl })),
    });
    if (!response.ok) {
      console.error("Discord webhook responded with", response.status);
    }
  } catch (error) {
    console.error("Discord webhook request failed", error);
  }
}
