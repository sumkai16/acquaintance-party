import { describe, expect, it } from "vitest";
import { formatReceiptNumber, paymentMethodLabel } from "./format";

describe("formatReceiptNumber", () => {
  it("pads the number to four digits", () => {
    expect(formatReceiptNumber(7, new Date("2026-09-17T07:28:00Z"))).toBe("AR-2026-0007");
  });

  it("keeps numbers past 9999 whole", () => {
    expect(formatReceiptNumber(12345, new Date("2026-09-17T07:28:00Z"))).toBe("AR-2026-12345");
  });

  it("takes the year in Manila time, not UTC", () => {
    // 20:00 UTC on Dec 31 is already Jan 1 in Manila.
    expect(formatReceiptNumber(1, new Date("2026-12-31T20:00:00Z"))).toBe("AR-2027-0001");
  });
});

describe("paymentMethodLabel", () => {
  it("names both methods plainly", () => {
    expect(paymentMethodLabel("gcash")).toBe("GCash (online)");
    expect(paymentMethodLabel("cash")).toBe("Cash (walk-in)");
  });
});
