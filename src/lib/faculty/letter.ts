import { EVENT, formatTimeRange } from "@/lib/config/event";

/**
 * The letter of invitation shown at /invitation, as plain TypeScript — the
 * same content-as-code pattern as src/lib/evaluation/questions.ts. Editing
 * this file is the whole change needed to reword the letter; nothing else
 * reads its wording.
 *
 * THE BODY IS A PLACEHOLDER until the organisers supply the real text, the
 * same way src/lib/config/event.ts marks its unconfirmed values. It is a
 * complete, sendable draft rather than lorem ipsum, so an unedited deploy is
 * survivable — but it is not the adviser's words.
 *
 * Bump LETTER_VERSION whenever the wording changes materially. It is stored
 * on every acknowledgement (faculty_invitations.letter_version), so the
 * record says which letter each person actually read — the same reasoning as
 * evaluations.form_version.
 */
export const LETTER_VERSION = "v1-placeholder";

export type Letter = {
  /** The line above the salutation, e.g. "Letter of Invitation". */
  title: string;
  salutation: string;
  /** Body paragraphs, in order. Plain strings — no markup. */
  paragraphs: readonly string[];
  /** The event details block, rendered as a list rather than prose. */
  details: readonly { label: string; value: string }[];
  closing: string;
  signatories: readonly { name: string; role: string }[];
};

const when = EVENT.startsAt.toLocaleDateString("en-PH", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Manila",
});

export const LETTER: Letter = {
  title: "Letter of Invitation",

  salutation: "Dear Members of the Faculty,",

  paragraphs: [
    `The ${EVENT.host} cordially invites you to the ${EVENT.name}, an evening ` +
      `set aside for the students, staff and faculty of the department to ` +
      `meet one another away from the classroom.`,

    `Your presence would mean a great deal to the students who organised it. ` +
      `Much of what this evening is for — welcoming the new batch, thanking ` +
      `the people who taught them — does not happen without you in the room.`,

    `Kindly confirm below that you have read this invitation. Doing so also ` +
      `enters you into the faculty giveaway, which will be drawn during the ` +
      `programme.`,
  ],

  details: [
    { label: "What", value: `${EVENT.name} — ${EVENT.tagline}` },
    { label: "When", value: `${when}, ${formatTimeRange(EVENT.startsAt, EVENT.endsAt)}` },
    { label: "Where", value: EVENT.venue },
    { label: "Host", value: EVENT.host },
  ],

  closing: "Respectfully yours,",

  signatories: EVENT.certificate.signatories,
};
