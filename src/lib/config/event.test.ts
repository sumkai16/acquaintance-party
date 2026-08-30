import { describe, expect, it } from "vitest";
import { EVENT, formatPeso, formatTimeRange } from "./event";

describe("formatPeso", () => {
  it("renders centavos as whole pesos with a thousands separator", () => {
    expect(formatPeso(35000)).toBe("₱350");
    expect(formatPeso(125000)).toBe("₱1,250");
  });

  it("shows centavos only when they are non-zero", () => {
    expect(formatPeso(35050)).toBe("₱350.50");
  });

  it("renders zero without decimals", () => {
    expect(formatPeso(0)).toBe("₱0");
  });
});

describe("EVENT", () => {
  it("prices the ticket in whole centavos", () => {
    expect(Number.isInteger(EVENT.ticketPriceCentavos)).toBe(true);
    expect(EVENT.ticketPriceCentavos).toBeGreaterThan(0);
  });

  it("prices the ticket at the confirmed ₱495", () => {
    expect(formatPeso(EVENT.ticketPriceCentavos)).toBe("₱495");
  });

  it("carries a GCash payee the student can actually pay", () => {
    expect(EVENT.gcash.name.length).toBeGreaterThan(0);
    expect(EVENT.gcash.number).toMatch(/^09\d{9}$/);
  });

  it("ends after it starts", () => {
    expect(EVENT.endsAt.getTime()).toBeGreaterThan(EVENT.startsAt.getTime());
  });
});

describe("formatTimeRange", () => {
  it("renders the confirmed 4–8 PM window", () => {
    expect(formatTimeRange(EVENT.startsAt, EVENT.endsAt)).toBe("4:00 PM – 8:00 PM");
  });

  it("formats an arbitrary start and end", () => {
    const start = new Date("2026-01-01T09:00:00+08:00");
    const end = new Date("2026-01-01T11:30:00+08:00");
    expect(formatTimeRange(start, end)).toBe("9:00 AM – 11:30 AM");
  });
});
