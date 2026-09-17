/**
 * The post-event evaluation, in one place.
 *
 * The organisers' questionnaire for the 2026 IT Acquaintance Party, with the
 * questions it asked twice kept only in their first place (e.g. "enjoyed
 * most", the overall rating, and the venue and food comment boxes). The
 * paper form's per-stage "Event flow breakdown" repeated the program grid, so
 * its two stages that weren't already asked — main and closing program — sit
 * in the program section instead.
 *
 * Editing this file is the whole change: the form, the validation schema, and
 * the admin summary are all generated from it. Bump FORM_VERSION when the
 * questions change so responses already in the database stay readable against
 * the wording that produced them.
 */
export const FORM_VERSION = "v1";

export const RATING_SCALE = [1, 2, 3, 4, 5] as const;

/** What each point means, straight from the organisers' form. */
export const RATING_LABELS: Record<(typeof RATING_SCALE)[number], string> = {
  1: "Poor",
  2: "Needs improvement",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

/** Stored in place of a number when a rating allows "did not participate". */
export const NOT_APPLICABLE = "na";

export type RatingQuestion = {
  kind: "rating";
  id: string;
  prompt: string;
  /** Offers N/A for parts of the night not everyone was there for. */
  allowNA?: boolean;
};

export type ChoiceQuestion = {
  kind: "choice";
  id: string;
  prompt: string;
  options: readonly string[];
  /** Blank is allowed and stored as null. */
  optional?: boolean;
};

/** Tick all that apply. Always optional — ticking nothing is an answer. */
export type MultiQuestion = {
  kind: "multi";
  id: string;
  prompt: string;
  options: readonly string[];
};

export type TextQuestion = {
  kind: "text";
  id: string;
  prompt: string;
  /** Free text is always optional — nobody should be forced to write prose. */
  placeholder: string;
};

export type Question =
  | RatingQuestion
  | ChoiceQuestion
  | MultiQuestion
  | TextQuestion;

export type Section = {
  id: string;
  title: string;
  questions: readonly Question[];
};

export const MAX_TEXT_LENGTH = 500;

const rating = (id: string, prompt: string, allowNA = false): RatingQuestion => ({
  kind: "rating",
  id,
  prompt,
  ...(allowNA ? { allowNA } : {}),
});

const text = (id: string, prompt: string): TextQuestion => ({
  kind: "text",
  id,
  prompt,
  placeholder: "Optional",
});

const AGREEMENT = [
  "Strongly agree",
  "Agree",
  "Neutral",
  "Disagree",
  "Strongly disagree",
] as const;

export const SECTIONS: readonly Section[] = [
  {
    id: "respondent",
    title: "About you",
    questions: [
      {
        kind: "choice",
        id: "year_level",
        prompt: "Year level",
        options: ["1st Year", "2nd Year", "3rd Year", "4th Year"],
        optional: true,
      },
      text("section", "Section"),
    ],
  },
  {
    id: "organization",
    title: "Event organization",
    questions: [
      rating("org_overall", "Overall organization of the event"),
      rating("org_registration", "Registration and attendance process"),
      rating("org_coordination", "Coordination of organizers"),
      rating("org_communication", "Communication of event information"),
      rating("org_flow", "Event flow and transitions"),
      rating("org_time", "Time management"),
      rating("org_staff", "Staff and officer assistance"),
    ],
  },
  {
    id: "program",
    title: "Program and activities",
    questions: [
      rating("prog_opening", "Opening program"),
      rating("prog_icebreakers", "Introduction and icebreaker activities"),
      rating("prog_games", "Games and activities"),
      rating("prog_performances", "Entertainment performances"),
      rating("prog_interactive", "Interactive and social activities"),
      rating("prog_main", "Main program", true),
      rating("prog_closing", "Closing program", true),
      rating("prog_variety", "Program variety"),
      rating("prog_appropriateness", "Appropriateness of activities"),
      rating("prog_enjoyment", "Overall enjoyment of the program"),
      text("prog_enjoyed_most", "Which part of the program did you enjoy the most?"),
      text("prog_needs_improvement", "Which part needs the most improvement?"),
      text("prog_add", "What activities would you like added to future IT Society events?"),
    ],
  },
  {
    id: "venue",
    title: "Venue and facilities",
    questions: [
      rating("venue_suitability", "Venue suitability"),
      rating("venue_cleanliness", "Cleanliness of the venue"),
      rating("venue_seating", "Seating arrangement"),
      rating("venue_stage", "Stage and setup arrangement"),
      rating("venue_lighting", "Lighting"),
      rating("venue_sound", "Sound system"),
      rating("venue_ventilation", "Ventilation and temperature"),
      rating("venue_accessibility", "Accessibility and movement around the venue"),
      rating("venue_comfort", "Comfort of the venue"),
      text("venue_liked", "What did you like about the venue?"),
      text("venue_improve", "What should be improved about the venue or facilities?"),
      {
        kind: "choice",
        id: "venue_problems",
        prompt: "Were there any problems with the venue?",
        options: ["No", "Yes"],
      },
      text("venue_problems_detail", "If yes, what was the problem?"),
    ],
  },
  {
    id: "food",
    title: "Food and catering",
    questions: [
      rating("food_quality", "Food quality"),
      rating("food_taste", "Taste of the food"),
      rating("food_variety", "Food variety"),
      rating("food_quantity", "Food quantity and serving size"),
      rating("food_presentation", "Food presentation"),
      rating("food_serving", "Serving and distribution process"),
      rating("food_overall", "Overall satisfaction with catering"),
      text("food_comments", "Comments or suggestions about the food and catering"),
    ],
  },
  {
    id: "atmosphere",
    title: "Theme, decorations, and atmosphere",
    questions: [
      rating("theme_event", "Event theme"),
      rating("theme_decorations", "Decorations"),
      rating("theme_visuals", "Visual presentation"),
      rating("theme_music", "Music and ambiance"),
      rating("theme_atmosphere", "Overall atmosphere"),
      rating("theme_consistency", "Consistency with the “Sunset Soiree” theme"),
      text("theme_comments", "Comments or suggestions about the theme, decorations, or atmosphere"),
    ],
  },
  {
    id: "production",
    title: "Hosts, performers, and technical production",
    questions: [
      rating("prod_hosts", "Hosts and emcees"),
      rating("prod_microphone", "Microphone and audio quality"),
      rating("prod_coordination", "Technical coordination"),
      rating("prod_transitions", "Smoothness of technical transitions"),
      text("prod_suggestions", "What technical or production improvements would you suggest?"),
    ],
  },
  {
    id: "overall",
    title: "Overall",
    questions: [
      rating("overall_experience", "How would you rate your overall experience?"),
      {
        kind: "choice",
        id: "overall_interaction",
        prompt: "The event gave me a chance to meet and interact with other IT students.",
        options: AGREEMENT,
      },
      {
        kind: "choice",
        id: "overall_camaraderie",
        prompt: "The event promoted camaraderie and stronger connections among IT students.",
        options: AGREEMENT,
      },
      {
        kind: "choice",
        id: "overall_future",
        prompt: "Would you join future IT Society events?",
        options: [
          "Definitely yes",
          "Probably yes",
          "Maybe",
          "Probably no",
          "Definitely no",
        ],
      },
    ],
  },
  {
    id: "improvement",
    title: "Areas for improvement",
    questions: [
      {
        kind: "multi",
        id: "improve_areas",
        prompt: "What should be improved in future IT Society events? Tick all that apply.",
        options: [
          "Event scheduling",
          "Program duration",
          "Event flow",
          "Games and activities",
          "Food/catering",
          "Venue",
          "Seating arrangement",
          "Sound system",
          "Lighting",
          "Decorations",
          "Hosts/Emcees",
          "Performances",
          "Registration/attendance",
          "Communication/announcements",
          "Crowd management",
          "Technical preparation",
          "Staff/officer coordination",
        ],
      },
      text("improve_other", "Anything else to improve? (Other)"),
      text("improve_one_change", "What is ONE thing you would change about this event?"),
      text("improve_done_well", "What is ONE thing the organizers did well?"),
      text("improve_keep", "What should the organizers KEEP doing in future events?"),
    ],
  },
  {
    id: "comments",
    title: "Comments and suggestions",
    questions: [
      text("comments_least", "What did you enjoy least about the event?"),
      text("comments_organizers", "Any comments about the organizers and officers?"),
      text("comments_next_event", "Any suggestions for the next IT Society event?"),
      text("comments_additional", "Additional comments, concerns, or recommendations"),
    ],
  },
];

export const QUESTIONS: readonly Question[] = SECTIONS.flatMap(
  (section) => section.questions,
);

export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((question) => question.id === id);
}
