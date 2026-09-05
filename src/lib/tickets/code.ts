/**
 * Crockford base32: the digits and uppercase letters, minus I, L, O and U.
 * Those four are dropped because a volunteer at the door will sometimes read
 * a code aloud when a camera will not focus, and I/1, L/1, O/0 are the pairs
 * that get misheard.
 *
 * Kept free of any node:crypto import — a client component (registration-row.tsx)
 * imports formatTicketCode from this file, and generateTicketCode lives in
 * ./generate.ts specifically so that import never drags a Node builtin into
 * the browser bundle.
 */
export const TICKET_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const TICKET_CODE_LENGTH = 12;

/** Groups a code as XXXX-XXXX-XXXX for printing and reading aloud. */
export function formatTicketCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

/**
 * Canonicalizes a code read from a camera or typed by a volunteer.
 *
 * The QR encodes the bare 12-character code, but the ticket page *displays*
 * the dashed form, so a fallback "type it in" path will see dashes. Casing is
 * normalized because a phone keyboard will happily send lowercase.
 */
export function normalizeScannedCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}
