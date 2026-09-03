/**
 * Someone eligible for the raffle: either approved and scanned in at the
 * door ("ticket"), or added by an admin because the scanner missed them or
 * they came from an imported list ("extra") — see `raffle_extra_entrants`.
 */
export type RaffleEntrant = {
  registrationId: string;
  fullName: string;
  yearLevel: string;
  section: string;
  source: "ticket" | "extra";
};

/**
 * One recorded draw.
 *
 * `finalists` is the snapshot taken at draw time, and the winner is always
 * one of them — see the comment at the top of 0002_raffle.sql for why this
 * records what was announced rather than joining live registration rows.
 */
export type RaffleDrawRow = {
  id: string;
  winner: RaffleEntrant;
  finalists: RaffleEntrant[];
  poolSize: number;
  drawnAt: string;
  isRedraw: boolean;
  supersedes: string | null;
};
