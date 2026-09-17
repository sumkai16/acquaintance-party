import { describe, expect, it } from "vitest";
import { isValidPartialAmount } from "./partial";

// EVENT.partialPaymentMinCentavos is 5_000 (₱50) as of this test — see
// src/lib/config/event.ts.
const FULL = 49_500;
const MIN = 5_000;

describe("isValidPartialAmount", () => {
  it("accepts exactly the flat minimum", () => {
    expect(isValidPartialAmount(MIN, FULL)).toBe(true);
  });

  it("accepts anything between the minimum and the full price", () => {
    expect(isValidPartialAmount(40_000, FULL)).toBe(true);
  });

  it("rejects anything below the minimum", () => {
    expect(isValidPartialAmount(MIN - 1, FULL)).toBe(false);
  });

  it("rejects the full price — that's a full sale, not a partial one", () => {
    expect(isValidPartialAmount(FULL, FULL)).toBe(false);
  });

  it("rejects an amount over the full price", () => {
    expect(isValidPartialAmount(FULL + 1, FULL)).toBe(false);
  });
});
