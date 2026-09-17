import { describe, expect, it } from "vitest";
import {
  expenseBalances,
  manilaLocalToIso,
  parsePesoToCentavos,
} from "./parse";

describe("parsePesoToCentavos", () => {
  it("parses a whole number of pesos", () => {
    expect(parsePesoToCentavos("150")).toBe(15000);
  });

  it("parses two decimal places", () => {
    expect(parsePesoToCentavos("150.50")).toBe(15050);
  });

  it("strips thousands separators", () => {
    expect(parsePesoToCentavos("1,250.75")).toBe(125075);
  });

  it("rejects zero and negative amounts", () => {
    expect(parsePesoToCentavos("0")).toBeNull();
    expect(parsePesoToCentavos("-5")).toBeNull();
  });

  it("rejects more than two decimal places", () => {
    expect(parsePesoToCentavos("150.505")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parsePesoToCentavos("abc")).toBeNull();
    expect(parsePesoToCentavos("")).toBeNull();
  });

  it("rejects an amount over the per-expense ceiling", () => {
    expect(parsePesoToCentavos("1000001")).toBeNull();
  });
});

describe("manilaLocalToIso", () => {
  it("attaches the fixed +08:00 offset", () => {
    expect(manilaLocalToIso("2026-01-01T12:00")).toBe("2026-01-01T12:00:00+08:00");
  });

  it("rejects a malformed value", () => {
    expect(manilaLocalToIso("not-a-date")).toBeNull();
  });

  it("rejects a time well in the future", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const value = future.toISOString().slice(0, 16);
    expect(manilaLocalToIso(value)).toBeNull();
  });
});

describe("expenseBalances", () => {
  it("subtracts spent from collected per method, and sums the totals", () => {
    const result = expenseBalances({
      cashCollectedCentavos: 100000,
      gcashCollectedCentavos: 50000,
      cashSpentCentavos: 30000,
      gcashSpentCentavos: 10000,
    });
    expect(result).toEqual({
      totalCashCentavos: 70000,
      totalGcashCentavos: 40000,
      totalAmountCentavos: 110000,
      totalExpensesCentavos: 40000,
    });
  });

  it("allows a method to go negative when overspent", () => {
    const result = expenseBalances({
      cashCollectedCentavos: 10000,
      gcashCollectedCentavos: 0,
      cashSpentCentavos: 15000,
      gcashSpentCentavos: 0,
    });
    expect(result.totalCashCentavos).toBe(-5000);
    expect(result.totalAmountCentavos).toBe(-5000);
  });
});
