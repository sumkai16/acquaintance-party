/**
 * GCash transaction reference numbers are thirteen digits. They are unique
 * per real transaction, which makes them the primary defence against a
 * student reusing a friend's receipt screenshot: the database holds a unique
 * index on the normalised value.
 *
 * This does not catch a forged screenshot carrying an invented number. That
 * is what admin review is for.
 */
const REFERENCE_DIGITS = 13;

/** Removes the spaces, dashes, and labels students paste in with the number. */
export function normalizeGcashReference(input: string): string {
  return input.replace(/\D/g, "");
}

export function isValidGcashReference(input: string): boolean {
  return normalizeGcashReference(input).length === REFERENCE_DIGITS;
}
