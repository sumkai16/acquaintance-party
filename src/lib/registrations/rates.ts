import { EVENT } from "@/lib/config/event";

/**
 * What a ticket costs its holder. Every online ticket and every staff sale is
 * `regular`; `officer` and `free` are recorded only by an admin, through the
 * single walk-in form, and are always paid in full on the spot — no partial.
 */
export const TICKET_RATES = ["regular", "officer", "free"] as const;
export type TicketRate = (typeof TICKET_RATES)[number];

export const RATE_LABEL: Record<TicketRate, string> = {
  regular: "Regular",
  officer: "Officer",
  free: "Free",
};

export function priceFor(rate: TicketRate): number {
  switch (rate) {
    case "regular":
      return EVENT.ticketPriceCentavos;
    case "officer":
      return EVENT.officerPriceCentavos;
    case "free":
      return 0;
  }
}

/** A form value narrowed to a known rate; anything unrecognized is null, not a silent "regular". */
export function parseTicketRate(value: string): TicketRate | null {
  return (TICKET_RATES as readonly string[]).includes(value) ? (value as TicketRate) : null;
}
