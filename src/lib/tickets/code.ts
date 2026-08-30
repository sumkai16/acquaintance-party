import { randomBytes } from "node:crypto";

/**
 * Crockford base32: the digits and uppercase letters, minus I, L, O and U.
 * Those four are dropped because a volunteer at the door will sometimes read
 * a code aloud when a camera will not focus, and I/1, L/1, O/0 are the pairs
 * that get misheard.
 */
export const TICKET_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const TICKET_CODE_LENGTH = 12;

/**
 * An opaque, unguessable ticket code — 12 characters over a 32-symbol
 * alphabet is 60 bits of entropy, far beyond anything brute-forceable.
 *
 * The code carries no personal data and is not derived from the registration
 * id, so photographing someone's QR reveals nothing about them.
 */
export function generateTicketCode(): string {
  // Masking to the low 5 bits keeps the draw uniform. A plain modulo would
  // also be unbiased at exactly 32 symbols, but would silently skew if the
  // alphabet ever changed length — the mask discards out-of-range draws
  // instead, which stays correct either way.
  const mask = 31; // 0b11111
  let out = "";

  while (out.length < TICKET_CODE_LENGTH) {
    for (const byte of randomBytes(TICKET_CODE_LENGTH)) {
      const index = byte & mask;
      if (index < TICKET_CODE_ALPHABET.length) {
        out += TICKET_CODE_ALPHABET[index];
        if (out.length === TICKET_CODE_LENGTH) break;
      }
    }
  }

  return out;
}

/** Groups a code as XXXX-XXXX-XXXX for printing and reading aloud. */
export function formatTicketCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}
