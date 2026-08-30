import { describe, expect, it } from "vitest";
import { buildRegistrationMessage } from "./discord-message";

describe("buildRegistrationMessage", () => {
  it("names the student, year, section, and formatted amount", () => {
    const message = buildRegistrationMessage({
      fullName: "Juan Miguel Dela Cruz",
      yearLevel: "3rd year",
      section: "B",
      amountCentavos: 50_000,
      reviewUrl: null,
    });
    expect(message).toContain("Juan Miguel Dela Cruz");
    expect(message).toContain("3rd year");
    expect(message).toContain("Section B");
    expect(message).toContain("₱500");
  });

  it("includes a clickable review link when a site URL is configured", () => {
    const message = buildRegistrationMessage({
      fullName: "Juan",
      yearLevel: "3rd year",
      section: "B",
      amountCentavos: 50_000,
      reviewUrl: "https://acquaintance-party.vercel.app/admin/review",
    });
    expect(message).toContain("https://acquaintance-party.vercel.app/admin/review");
  });

  it("still reads as a complete message with no link configured", () => {
    const message = buildRegistrationMessage({
      fullName: "Juan",
      yearLevel: "3rd year",
      section: "B",
      amountCentavos: 50_000,
      reviewUrl: null,
    });
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain("null");
    expect(message).not.toContain("undefined");
  });
});
