import { describe, expect, it } from "vitest";
import { EVENT } from "@/lib/config/event";
import { parseTicketRate, priceFor } from "./rates";

describe("priceFor", () => {
  it("charges the full ticket price for a regular ticket", () => {
    expect(priceFor("regular")).toBe(EVENT.ticketPriceCentavos);
  });

  it("charges ₱250 for an officer ticket", () => {
    expect(priceFor("officer")).toBe(25_000);
  });

  it("charges nothing for a free ticket", () => {
    expect(priceFor("free")).toBe(0);
  });

  it("keeps the officer price below the regular one", () => {
    expect(priceFor("officer")).toBeLessThan(priceFor("regular"));
  });
});

describe("parseTicketRate", () => {
  it("accepts each known rate", () => {
    expect(parseTicketRate("regular")).toBe("regular");
    expect(parseTicketRate("officer")).toBe("officer");
    expect(parseTicketRate("free")).toBe("free");
  });

  it("rejects anything else rather than falling back to regular", () => {
    expect(parseTicketRate("")).toBeNull();
    expect(parseTicketRate("Officer")).toBeNull();
    expect(parseTicketRate("vip")).toBeNull();
  });
});
