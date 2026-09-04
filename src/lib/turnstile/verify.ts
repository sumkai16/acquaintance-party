import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Checks a Turnstile token server-side before checkout writes anything.
 *
 * Not configured (`TURNSTILE_SECRET_KEY` unset) skips the check entirely —
 * checkout works the same as before Turnstile existed, matching every other
 * optional integration's contract in this codebase.
 *
 * A missing/expired/reused token is a real reject: `ok: false`. A network
 * error or an unreachable Cloudflare is not — fails open, same reasoning as
 * the honeypot removal in `context/RULES.md`: for a small one-off event,
 * blocking a real paying student because a third-party API had a bad moment
 * is worse than the bot traffic Turnstile is guarding against.
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
): Promise<{ ok: boolean }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true }; // Not configured — skip silently, not an error.

  if (!token) return { ok: false };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);

    const response = await fetch(VERIFY_URL, { method: "POST", body });
    if (!response.ok) {
      console.error("Turnstile siteverify responded with", response.status);
      return { ok: true }; // fail open — see comment above
    }

    const result = (await response.json()) as { success: boolean };
    return { ok: result.success };
  } catch (error) {
    console.error("Turnstile siteverify request failed", error);
    return { ok: true }; // fail open — see comment above
  }
}
