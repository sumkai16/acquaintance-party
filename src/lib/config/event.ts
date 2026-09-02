/**
 * Single source of truth for event details.
 *
 * All values below are PLACEHOLDERS until the organisers confirm them.
 * Changing the event must never require touching a component.
 *
 * Keep the theme tokens in src/lib/config/theme.ts in sync with the @theme
 * block in src/app/globals.css.
 */
export const EVENT = {
  name: "Acquaintance Party",
  tagline: "Sunset Soiree",
  host: "BSIT Department",
  startsAt: new Date("2026-10-05T16:00:00+08:00"),
  endsAt: new Date("2026-10-05T20:00:00+08:00"),
  venue: "SCC Annex Building",
  ticketPriceCentavos: 49_500,
  capacity: 700,

  /** Where a student goes when something goes wrong. PLACEHOLDER. */
  contact: "Message the BSIT Department page on Facebook.",

  /** The GCash account students send payment to. */
  gcash: {
    name: "JUAN D. CRUZ",
    number: "09171234567",
    /** Path under /public to the payee's GCash QR screenshot. */
    qrImage: "/gcash-qr.png",
    /**
     * Shown next to the payee details. Deliberately doesn't name a specific
     * verification channel (a group chat, a poster) that isn't confirmed to
     * exist — stays true regardless of how the department actually shares
     * the account.
     */
    verifyNote:
      "Double-check this matches the account your organiser shared — never send payment to one you can't verify.",
  },

  /**
   * What the ticket gets you, shown on the landing page.
   *
   * PLACEHOLDER apart from the raffle line, which describes how the system
   * actually behaves: eligibility comes from being scanned at the door.
   */
  inclusions: [
    {
      title: "Entry for one",
      body: "One ticket admits one student. Bring your QR and a school ID.",
    },
    {
      title: "Food and drinks",
      body: "Included in the ticket price. No separate payment at the venue.",
    },
    {
      title: "Raffle entry",
      body: "Everyone scanned in at the door goes into the raffle. No scan, no entry.",
    },
  ],

  /**
   * Landing page FAQ. These answers describe real system behaviour — check
   * the checkout and ticket flows still work this way before editing them.
   */
  faq: [
    {
      question: "How long until my ticket is approved?",
      answer:
        "We check every receipt by hand, in the order it arrives — the earlier you submit, the sooner you'll hear back. Your ticket link works straight away and shows “pending review” until then; keep the link, it updates on its own, and we'll also email you once it's approved.",
    },
    {
      question: "What if my receipt is rejected?",
      answer:
        "Your ticket page shows the reason it was rejected. Fix what it says and submit again — a rejected attempt does not use up your GCash reference.",
    },
    {
      question: "I lost my ticket link.",
      answer:
        "An organiser can find it using the name and email you signed up with. Ask before the day of the event, not in the queue at the door.",
    },
    {
      question: "Can I screenshot my QR code?",
      answer:
        "Yes — a screenshot scans exactly like the live page, which is useful if the venue signal is bad. Do not share it: a ticket is admitted once, and the second scan is flagged as a duplicate.",
    },
  ],
} as const;

const withDecimals = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
});

const wholePesos = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Renders a start/end pair as "4:00 PM – 8:00 PM". */
export function formatTimeRange(start: Date, end: Date): string {
  const time = (date: Date) =>
    date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

  return `${time(start)} – ${time(end)}`;
}

/**
 * Formats centavos for display. Drops the decimals when they are zero.
 *
 * Built from parts rather than a single formatted string so the non-breaking
 * space Intl inserts after the peso sign can be dropped cleanly.
 */
export function formatPeso(centavos: number): string {
  const pesos = centavos / 100;
  const formatter = centavos % 100 === 0 ? wholePesos : withDecimals;

  return formatter
    .formatToParts(pesos)
    .map((part) => part.value)
    .join("")
    .replace(/ /g, "");
}
