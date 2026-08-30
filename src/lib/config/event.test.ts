import { describe, expect, it } from "vitest";
import { EVENT, formatPeso } from "./event";

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

  it("carries a GCash payee the student can actually pay", () => {
    expect(EVENT.gcash.name.length).toBeGreaterThan(0);
    expect(EVENT.gcash.number).toMatch(/^09\d{9}$/);
  });
});
