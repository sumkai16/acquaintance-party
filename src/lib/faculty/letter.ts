import { EVENT, formatTimeRange } from "@/lib/config/event";

/**
 * The letter of invitation shown at /invitation, as plain TypeScript — the
 * same content-as-code pattern as src/lib/evaluation/questions.ts. Editing
 * this file is the whole change needed to reword the letter; nothing else
 * reads its wording.
 *
 * The copy and the field names follow mockup 11a ("Great Vibes script") from
 * the Landing page redesign mockups, chosen 2026-09-20. It is still not the
 * adviser's own text — but it has been through a design pass, so it is a
 * deliberate draft rather than a stand-in.
 *
 * Bump LETTER_VERSION whenever the wording changes materially. It is stored
 * on every acknowledgement (faculty_invitations.letter_version), so the
 * record says which letter each person actually read — the same reasoning as
 * evaluations.form_version.
 */
export const LETTER_VERSION = "v2";

export type Letter = {
  /** Small caps above the title. */
  eyebrow: string;
  /** Set in script — kept to two short words so it reads at 62px. */
  title: string;
  /** Small caps under the rule, leading into the host's name. */
  overline: string;
  org: string;
  /** Body paragraphs, in order. Plain strings — no markup. */
  paragraphs: readonly string[];
  when: string;
  where: string;
  closing: string;
  /** Rendered as one row of three, so the roles must stay short. */
  signatories: readonly { name: string; role: string }[];
};

/** "Saturday · Oct 3, 2026 · 2:30 PM – 8:00 PM" */
function whenLine(): string {
  const date = EVENT.startsAt.toLocaleDateString("en-PH", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
  // toLocaleDateString gives "Saturday, Oct 3, 2026" — the mockup separates
  // every part with the same middot, so the comma after the weekday goes.
  return `${date.replace(",", " ·")} · ${formatTimeRange(EVENT.startsAt, EVENT.endsAt)}`;
}

export const LETTER: Letter = {
  eyebrow: "Please read with care",
  title: "Letter of\nInvitation",
  overline: "for the acquaintance party of",
  org: EVENT.host,

  paragraphs: [
    `Dear Members of the Faculty, the ${EVENT.host} cordially invites you to ` +
      `the ${EVENT.name}, an evening set aside for the students, staff and ` +
      `faculty of the department to meet one another away from the classroom.`,

    `Your presence would mean a great deal to the students who organised it. ` +
      `Much of what this evening is for — welcoming the new batch, thanking ` +
      `the people who taught them — does not happen without you in the room. ` +
      `Kindly confirm below that you have read this invitation.`,
  ],

  when: whenLine(),
  where: EVENT.venue,
  closing: "Respectfully yours,",

  /**
   * Not EVENT.certificate.signatories: the mockup reverses that order and
   * abbreviates "BSIT Department Governor", because these sit in one row of
   * three on a 400px card and each role has to hold on a single line. The
   * certificate's own order is set by the artwork behind it and must not
   * follow this.
   */
  signatories: [
    { name: "Axcee F. Cabusas", role: "Technology Officer" },
    { name: "Brendon Benitez", role: "BSIT Dept. Governor" },
    { name: "Kenneth Canon", role: "Treasurer" },
  ],
};
