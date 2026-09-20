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

/**
 * One line of the running order. `who` is whoever is up for that line, when
 * the program names someone.
 */
export type ProgramItem = { label: string; who?: string };

export type ProgramSlot = {
  /** "5:00 – 5:15 PM", as printed. */
  time: string;
  title: string;
  items: readonly ProgramItem[];
};

export type ProgramPart = { title: string; slots: readonly ProgramSlot[] };

/**
 * The program proper, from docs/ProgramFlow.docx (the committee's working
 * copy). This is what a guest needs to plan an evening around, so it is
 * deliberately NOT the whole document:
 *
 * - Left out on purpose: the "Preparation for the Registration" slot (a
 *   committee call time, not a guest one), the placeholder "-" intermission
 *   rows, and the Performance Order / Mechanics / Judging Criteria pages.
 *   The last three are the contestants' rules, not the guests' program.
 * - "Words of inspiration" carries no speaker: the source reads "Ms. Tapere
 *   or Ms. Bacordo", an undecided choice that would read as an unfinished
 *   letter. Add the name here once it is settled.
 *
 * The times are the document's own, and they do not fully agree with
 * EVENT.startsAt/endsAt: the program runs to 8:10 PM where the event is
 * configured to end at 8:00, and nothing is scheduled between 4:30 and 5:00.
 * That is for the organisers to reconcile, not this file to hide.
 */
export const PROGRAM: readonly ProgramPart[] = [
  {
    title: "Part I",
    slots: [
      {
        time: "3:30 – 4:30 PM",
        title: "Registration",
        items: [
          { label: "Opening of registration", who: "Board Members and PRO Officers" },
          { label: "Giving of souvenirs" },
        ],
      },
      {
        time: "5:00 – 5:15 PM",
        title: "Invocation",
        items: [
          { label: "Opening prayer", who: "Mr. Kingsly Cabiles, Vice Governor" },
          { label: "National Anthem" },
          { label: "Cecilian Hymn" },
        ],
      },
      {
        time: "5:15 – 5:45 PM",
        title: "Opening Remarks",
        items: [
          {
            label: "Walk of the Luminous Leaders",
            who: "AVP, College Dean, guests and ITech officers",
          },
          { label: "Welcome remarks", who: "Ms. Hitchean Lisondra, College Dean" },
          { label: "Words of inspiration" },
          { label: "Acknowledgement of dignitaries" },
          { label: "Oath-taking of officers", who: "Ms. Hitchean Lisondra, College Dean" },
          { label: "Intermission number", who: "ITech officers" },
          { label: "Band serenade", who: "IT Band, 3 songs" },
        ],
      },
      {
        time: "5:45 – 6:30 PM",
        title: "Entertainment and Performances",
        items: [
          { label: "Early bird — the first five students to register" },
          { label: "Bring Me" },
          { label: "Games and Battle of the Bands" },
          { label: "Four raffle draws, with the raffle packages" },
        ],
      },
      {
        time: "6:30 – 7:00 PM",
        title: "Dinner Break",
        items: [
          { label: "Dinner" },
          { label: "Band serenade", who: "IT Band, 5 songs" },
        ],
      },
    ],
  },
  {
    title: "Part II",
    slots: [
      {
        time: "7:00 – 7:30 PM",
        title: "Shining Stars Recognition",
        items: [
          { label: "Sunset Walk and Grand Entrance", who: "Selected pairs" },
          { label: "Battle of the Bands — awarding" },
          { label: "Mr. & Ms. Sunset Soiree" },
          { label: "Mr. & Ms. Golden Glow" },
          { label: "Mr. & Ms. Sunset Charm" },
          { label: "Mr. & Ms. Evening Radiance" },
          { label: "Mr. & Ms. Golden Elegance" },
          { label: "Mr. & Ms. Sunset Personality" },
        ],
      },
      {
        time: "7:30 – 7:50 PM",
        title: "Raffle Draws",
        items: [{ label: "Raffle" }],
      },
      {
        time: "7:50 – 8:00 PM",
        title: "Closing Performance",
        items: [{ label: "Band serenade", who: "IT Band, 3 songs" }],
      },
      {
        time: "8:00 – 8:10 PM",
        title: "Closing Remarks",
        items: [{ label: "Closing remarks", who: "Ms. Rica Mae Patenio" }],
      },
    ],
  },
];
