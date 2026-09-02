/** A student eligible for the raffle: approved, and scanned in at the door. */
export type RaffleEntrant = {
  registrationId: string;
  fullName: string;
  yearLevel: string;
  section: string;
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
  prizeKey: string;
  prizeName: string;
  winner: RaffleEntrant;
  finalists: RaffleEntrant[];
  poolSize: number;
  drawnAt: string;
  isRedraw: boolean;
  supersedes: string | null;
};
