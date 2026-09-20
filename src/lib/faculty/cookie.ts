/**
 * Marks this browser as having already entered, so a second scan of the
 * shared QR opens straight on "you're on the list" instead of a blank form
 * that would take their name and then refuse it.
 *
 * It holds the name they gave, which is their own data in their own browser.
 * It is a convenience, never a guard: the unique index on the name in
 * `faculty_invitations` is what actually stops a double entry, and clearing
 * this cookie gets someone a form, not a second entry.
 *
 * Lives in its own module because a "use server" file may only export async
 * functions, so the action cannot export this constant itself.
 */
export const ENTERED_COOKIE = "faculty_entered";

/** Long enough to cover the run-up to the event and the night itself. */
export const ENTERED_COOKIE_MAX_AGE = 60 * 60 * 24 * 120;
