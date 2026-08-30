/**
 * Cheap defences against someone flooding the review queue.
 *
 * Neither of these stops a determined attacker. They stop a script and a
 * bored student, which is the realistic threat for a school event, and they
 * cost one hidden input and one indexed query.
 */

/**
 * A field no human sees. Bots fill every input they find, so any value here
 * means the submission was not typed by a person. Named "nickname" rather
 * than "honeypot" so it is not obvious from the page source.
 */
export const HONEYPOT_FIELD = "nickname";

export const THROTTLE_WINDOW_MINUTES = 15;

/**
 * Three attempts per email per window. A real student legitimately retries —
 * wrong reference number, bad photo, a failed upload — so the limit has to
 * sit above normal frustration, not at it.
 */
export const THROTTLE_MAX_SUBMISSIONS = 3;

export function isHoneypotTripped(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== "string") return true;
  return value.trim().length > 0;
}

/** The earliest timestamp still inside the throttle window. */
export function throttleWindowStart(now: Date): string {
  return new Date(now.getTime() - THROTTLE_WINDOW_MINUTES * 60_000).toISOString();
}

export function isThrottled(recentCount: number): boolean {
  return recentCount >= THROTTLE_MAX_SUBMISSIONS;
}
