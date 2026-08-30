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
  /** The theme is not finalised. Replace this once the committee decides. */
  tagline: "Theme to be announced",
  host: "BSIT Department",
  /** DATE IS STILL A PLACEHOLDER — only the time (4–8 PM) has been confirmed. */
  startsAt: new Date("2026-09-12T16:00:00+08:00"),
  endsAt: new Date("2026-09-12T20:00:00+08:00"),
  venue: "SCC Annex Building",
  ticketPriceCentavos: 49_500,
  capacity: 700,

  /** The GCash account students send payment to. */
  gcash: {
    name: "JUAN D. CRUZ",
    number: "09171234567",
    /** Path under /public to the payee's GCash QR screenshot. */
    qrImage: "/gcash-qr.png",
  },
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
