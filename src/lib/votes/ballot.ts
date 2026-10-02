import { CROWD_CHOICE, type Act, type Category } from "@/lib/config/battle";

/**
 * Pure ballot logic for the Crowd's Choice vote — no I/O, so it is unit
 * tested. The database half is queries.ts (server-only).
 */

export type BallotInput = { band: string; solo: string };

export type BallotResult =
  | { ok: true; band: string; solo: string }
  | { ok: false; error: string };

/**
 * One band and one solo, both from the line-up. Checked on the server on
 * every submit: the form's radio buttons are a convenience, not the rule, and
 * a hand-built request must not be able to write a key the line-up lacks —
 * or a solo act into the band slot.
 */
export function validateBallot(input: BallotInput): BallotResult {
  const bandKeys = CROWD_CHOICE.band.acts.map((act) => act.key as string);
  const soloKeys = CROWD_CHOICE.solo.acts.map((act) => act.key as string);

  if (!input.band || !input.solo) {
    return { ok: false, error: "Pick one band and one solo before you submit." };
  }
  if (!bandKeys.includes(input.band) || !soloKeys.includes(input.solo)) {
    return { ok: false, error: "That pick isn't in the line-up. Reload the page and try again." };
  }
  return { ok: true, band: input.band, solo: input.solo };
}

export type VoteRow = { band_choice: string; solo_choice: string };

export type TallyRow = { key: string; name: string; votes: number };

export type Tally = {
  total: number;
  band: TallyRow[];
  solo: TallyRow[];
  /** Every act on the top count — more than one is a tie, none is no votes yet. */
  winners: Record<Category, Act[]>;
};

/**
 * Counts every act (those with no votes too), most votes first, ties kept in
 * line-up order. A tie is reported as a tie: picking one of two acts on the
 * same count would be the software deciding the award.
 */
export function tally(rows: VoteRow[]): Tally {
  const counts: Record<Category, Map<string, number>> = {
    band: new Map(),
    solo: new Map(),
  };
  for (const row of rows) {
    counts.band.set(row.band_choice, (counts.band.get(row.band_choice) ?? 0) + 1);
    counts.solo.set(row.solo_choice, (counts.solo.get(row.solo_choice) ?? 0) + 1);
  }

  const build = (category: Category): TallyRow[] =>
    CROWD_CHOICE[category].acts
      .map((act) => ({
        key: act.key as string,
        name: act.name as string,
        votes: counts[category].get(act.key) ?? 0,
      }))
      .sort((a, b) => b.votes - a.votes);

  const band = build("band");
  const solo = build("solo");

  const winnersOf = (list: TallyRow[]): Act[] => {
    const top = list[0]?.votes ?? 0;
    if (top === 0) return [];
    return list.filter((row) => row.votes === top).map(({ key, name }) => ({ key, name }));
  };

  return {
    total: rows.length,
    band,
    solo,
    winners: { band: winnersOf(band), solo: winnersOf(solo) },
  };
}
