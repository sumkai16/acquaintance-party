import "server-only";

/**
 * Which Resend account outgoing mail uses. The free tier caps sends per
 * account, so up to three backup accounts can be configured and switched to
 * by setting RESEND_ACTIVE_ACCOUNT to 1, 2 or 3. Unset (or "main") keeps the
 * original RESEND_API_KEY — switching back is clearing that one variable.
 *
 * A backup with no RESEND_FROM_EMAIL_<n> falls back to the main sender, which
 * only works if that domain is verified on the backup account too.
 */
const BACKUP_SLOTS = ["1", "2", "3"] as const;

export type ResendAccount = { apiKey: string | undefined; from: string | undefined };

export function resendAccount(): ResendAccount {
  const active = process.env.RESEND_ACTIVE_ACCOUNT?.trim();
  if (active && (BACKUP_SLOTS as readonly string[]).includes(active)) {
    return {
      apiKey: process.env[`RESEND_API_KEY_${active}`],
      from: process.env[`RESEND_FROM_EMAIL_${active}`] || process.env.RESEND_FROM_EMAIL,
    };
  }
  return { apiKey: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM_EMAIL };
}

/**
 * Every webhook signing secret configured, main first. Each Resend account
 * signs with its own secret, and a bounce can arrive from any account that
 * sent mail, even after switching away from it.
 */
export function resendWebhookSecrets(): string[] {
  return [
    process.env.RESEND_WEBHOOK_SECRET,
    ...BACKUP_SLOTS.map((slot) => process.env[`RESEND_WEBHOOK_SECRET_${slot}`]),
  ].filter((secret): secret is string => Boolean(secret));
}
