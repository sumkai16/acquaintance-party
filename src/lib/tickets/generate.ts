import { randomBytes } from "node:crypto";
import { TICKET_CODE_ALPHABET, TICKET_CODE_LENGTH } from "./code";

/**
 * An opaque, unguessable ticket code — 12 characters over a 32-symbol
 * alphabet is 60 bits of entropy, far beyond anything brute-forceable.
 *
 * The code carries no personal data and is not derived from the registration
 * id, so photographing someone's QR reveals nothing about them.
 *
 * Split out of ./code.ts (2026-09-05): that file is imported from a client
 * component for formatTicketCode, and node:crypto has no browser bundle —
 * webpack fails the whole build the moment anything in the same module
 * touches it, even code the client never calls.
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
