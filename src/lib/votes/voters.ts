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

/** What the public search is allowed to show: no id, no email. */
export type VoterChoice = { fullName: string; yearLevel: string; section: string };

export const MIN_QUERY_LENGTH = 2;
export const MAX_RESULTS = 8;

/** Lowercase, accents and double spaces removed — "  MARÍA   santos " → "maria santos". */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Every typed word must appear somewhere in the name, in any order, so
 * "cruz juan" finds "Juan Dela Cruz". Names that start with what was typed
 * come first. Capped at `limit`: this runs for hundreds of phones at once,
 * and nobody scrolls past eight.
 */
export function matchVoters(
  voters: Voter[],
  query: string,
  limit: number = MAX_RESULTS,
): Voter[] {
  const normalized = normalizeName(query);
  if (normalized.length < MIN_QUERY_LENGTH) return [];

  const words = normalized.split(" ");
  const matches: { voter: Voter; startsWith: boolean }[] = [];

  for (const voter of voters) {
    const name = normalizeName(voter.fullName);
    if (words.every((word) => name.includes(word))) {
      matches.push({ voter, startsWith: name.startsWith(normalized) });
    }
  }

  matches.sort((a, b) => Number(b.startsWith) - Number(a.startsWith));
  return matches.slice(0, limit).map((match) => match.voter);
}

/**
 * The voter who owns this name *and* this email. The name is what the
 * student picked from the search; the email is what proves it is them — the
 * list is public by design, the email is not. Two people sharing a name are
 * told apart by it.
 */
export function findVoter(voters: Voter[], fullName: string, email: string): Voter | null {
  const wantedName = normalizeName(fullName);
  const wantedEmail = email.trim().toLowerCase();
  if (!wantedName || !wantedEmail) return null;

  return (
    voters.find(
      (voter) => normalizeName(voter.fullName) === wantedName && voter.email === wantedEmail,
    ) ?? null
  );
}
