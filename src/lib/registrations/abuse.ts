/**
 * Cheap defences against someone flooding the Payments queue.
 *
 * A hidden-field honeypot used to sit here too, but browser and extension
 * autofill silently fills off-screen fields regardless of visibility —
 * confirmed live (2026-08-30) when a real student's submission was rejected
 * with the hidden field carrying an autofilled name, "Judah Ruiz", with no
 * error shown. For a small, one-off student event, blocking a real paying
 * student's first attempt is a worse outcome than the bot traffic the
 * honeypot was guarding against, which the unique GCash reference index and
 * the throttle below already cover. Removed rather than patched — fighting
 * browser autofill heuristics is not a fight worth having here.
 */

export const THROTTLE_WINDOW_MINUTES = 15;

/**
 * Three attempts per email per window. A real student legitimately retries —
 * wrong reference number, bad photo, a failed upload — so the limit has to
 * sit above normal frustration, not at it.
 */
export const THROTTLE_MAX_SUBMISSIONS = 3;

/** The earliest timestamp still inside the throttle window. */
export function throttleWindowStart(now: Date): string {
  return new Date(now.getTime() - THROTTLE_WINDOW_MINUTES * 60_000).toISOString();
}

export function isThrottled(recentCount: number): boolean {
  return recentCount >= THROTTLE_MAX_SUBMISSIONS;
}
