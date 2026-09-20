/**
 * Which pool a draw runs against. Students and faculty are drawn separately
 * all night — separate pools, separate winner histories, separate "exclude
 * previous winners" sets. Stored on every draw as `raffle_draws.audience`.
 */
export type RaffleAudience = "student" | "faculty";

/**
 * Someone eligible for the raffle: approved and scanned in at the door
 * ("ticket"), added by an admin because the scanner missed them or they came
 * from an imported list ("extra" — see `raffle_extra_entrants`), or a faculty
 * member who acknowledged the invitation ("faculty" — see
 * `faculty_invitations`).
 *
 * `yearLevel`/`section` are the student sub-line; faculty carry `department`
 * instead. Read them through entrantDetail() in ./pool.ts rather than
 * formatting the pair directly, so a faculty winner never renders as "— · —".
 */
export type RaffleEntrant = {
  registrationId: string;
  fullName: string;
  yearLevel: string;
  section: string;
  source: "ticket" | "extra" | "faculty";
  department?: string | null;
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
