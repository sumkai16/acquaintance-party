/**
 * Who can vote, and how a typed name finds them. Pure — queries.ts is the
 * server-only half that loads the checked-in list.
 */

export type Voter = {
  registrationId: string;
  fullName: string;
  yearLevel: string;
  section: string;
  /** Lowercased. Server-only: it is the check, so it never leaves the server. */
  email: string;
};

/**
 * Lowercase, with accents, punctuation and double spaces removed —
 * "  Dela Cruz,  MARÍA  S. " → "dela cruz maria s".
 */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameWords(value: string): string[] {
  const normalized = normalizeName(value);
  return normalized ? normalized.split(" ") : [];
}

/** Equal, or one is a lone initial of the other ("m" ~ "miguel"). */
function sameWord(a: string, b: string): boolean {
  return a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));
}

/**
 * Is the typed name this registered name? Word order is ignored, so
 * "Dela Cruz, Juan M." and "Juan M. Dela Cruz" both match "Juan Miguel Dela
 * Cruz" — registrations were typed free-form, some as "Last, First". A lone
 * letter is a middle initial. Every typed word must be found, and at least a
 * first and a last name (two full words) must be typed, so "Juan" or "J M"
 * is never enough.
 *
 * This is deliberately loose: the name is not the secret, the email is.
 */
export function namesMatch(typed: string, registered: string): boolean {
  const wanted = nameWords(typed);
  if (wanted.filter((word) => word.length > 1).length < 2) return false;

  const pool = nameWords(registered);

  // Exact words first, so an initial can't use up the word a full name needs.
  const rest: string[] = [];
  for (const word of wanted) {
    const at = pool.indexOf(word);
    if (at >= 0) pool.splice(at, 1);
    else rest.push(word);
  }

  return rest.every((word) => {
    const at = pool.findIndex((candidate) => sameWord(word, candidate));
    if (at < 0) return false;
    pool.splice(at, 1);
    return true;
  });
}

/**
 * The voter who owns this name *and* this email. The name is what the
 * student typed; the email is what proves it is them. Two people sharing a
 * name are told apart by it.
 */
export function findVoter(voters: Voter[], fullName: string, email: string): Voter | null {
  const wantedEmail = email.trim().toLowerCase();
  if (!wantedEmail) return null;

  return (
    voters.find((voter) => voter.email === wantedEmail && namesMatch(fullName, voter.fullName)) ??
    null
  );
}
