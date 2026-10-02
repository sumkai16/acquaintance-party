/**
 * The Battle of the Beats line-up, and the crowd vote on it.
 *
 * The `key` is what is stored in crowd_votes, so it must never be changed
 * once votes exist — rename `name` freely, never `key`. The ballot is checked
 * against this list on the server (src/lib/votes/ballot.ts), so a key that is
 * not here cannot be written.
 *
 * `photo` is optional. Put the file under public/acts/ and set it here
 * (e.g. "/acts/h4nzo.jpg"); an act with none shows its initials instead.
 * It is set per act rather than assumed from the key, so an act whose photo
 * has not arrived never asks for a file that is not there.
 */
export type Act = { key: string; name: string; photo?: string };

const BAND_ACTS: readonly Act[] = [
  { key: "burnout-band", name: "Burnout Band", photo: "/acts/burnout-band.png" },
  { key: "six-of-seven", name: "Six of Seven", photo: "/acts/six-of-seven.png" },
];

const SOLO_ACTS: readonly Act[] = [
  { key: "lovely-yungod", name: "Lovely Yungod" },
  { key: "marlo-alcaya", name: "Marlo Alcaya" },
  { key: "h4nzo", name: "H4NZO" },
  { key: "nap-batoon", name: "Nap Batoon" },
  { key: "ericson-bareno", name: "Ericson Bareno" },
];

export const CROWD_CHOICE = {
  /** The award, as students and the projector call it. */
  award: "Crowd's Choice",
  band: { label: "Band", acts: BAND_ACTS },
  solo: { label: "Solo", acts: SOLO_ACTS },
} as const;

export type Category = "band" | "solo";
export const CATEGORIES: readonly Category[] = ["band", "solo"];
