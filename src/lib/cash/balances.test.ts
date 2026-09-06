import { describe, expect, it } from "vitest";
import { availableToRemitCentavos, currentCollectionCentavos } from "./balances";

describe("currentCollectionCentavos", () => {
  it("does not drop while a remittance is only pending — matches the spec's example", () => {
    // Staff has collected 3000, submitted (but not yet approved) a 3000 remittance.
    expect(currentCollectionCentavos(300000, 0)).toBe(300000);
  });

  it("drops by exactly the approved amount once a remittance is approved", () => {
    expect(currentCollectionCentavos(300000, 300000)).toBe(0);
  });

  it("never goes negative even if inputs are inconsistent", () => {
    expect(currentCollectionCentavos(100000, 300000)).toBe(0);
  });
});

describe("availableToRemitCentavos", () => {
  it("equals current collection when nothing is pending", () => {
    expect(availableToRemitCentavos(300000, 0)).toBe(300000);
  });

  it("is zero while the full collected amount is already pending — blocks a second remittance", () => {
    expect(availableToRemitCentavos(300000, 300000)).toBe(0);
  });

  it("never goes negative", () => {
    expect(availableToRemitCentavos(100000, 300000)).toBe(0);
  });
});
