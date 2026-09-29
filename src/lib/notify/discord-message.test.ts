import { describe, expect, it } from "vitest";
import {
  buildHelpRequestPayload,
  buildRegistrationPayload,
  hexToDiscordColor,
} from "./discord-message";

const base = {
  fullName: "Juan Miguel Dela Cruz",
  yearLevel: "3rd year",
  section: "B",
  amountCentavos: 50_000,
  gcashReference: "1234567890123",
  reviewUrl: null as string | null,
};

describe("hexToDiscordColor", () => {
  it("converts a theme hex color to the decimal integer Discord's API expects", () => {
    // #C2481F = 12,732,447 in decimal — checked against a manual conversion,
    // not just re-deriving the same formula the implementation uses.
    expect(hexToDiscordColor("#C2481F")).toBe(12_732_447);
  });

  it("handles pure black and white at the range boundaries", () => {
    expect(hexToDiscordColor("#000000")).toBe(0);
    expect(hexToDiscordColor("#FFFFFF")).toBe(16_777_215);
  });
});

describe("buildRegistrationPayload", () => {
  it("puts the student, year/section, amount, and reference in the embed fields", () => {
    const payload = buildRegistrationPayload(base);
    const embed = payload.embeds[0];
    const fieldText = embed.fields.map((f) => `${f.name} ${f.value}`).join(" ");

    expect(fieldText).toContain("Juan Miguel Dela Cruz");
    expect(fieldText).toContain("3rd year");
    expect(fieldText).toContain("Section B");
    expect(fieldText).toContain("₱500");
    expect(fieldText).toContain("1234567890123");
  });

  it("sends no more than one embed, matching Discord's rendering of a single notification", () => {
    const payload = buildRegistrationPayload(base);
    expect(payload.embeds).toHaveLength(1);
  });

  it("makes the title a clickable link when a review URL is configured", () => {
    const payload = buildRegistrationPayload({
      ...base,
      reviewUrl: "https://acquaintance-party.vercel.app/admin/review",
    });
    expect(payload.embeds[0].url).toBe(
      "https://acquaintance-party.vercel.app/admin/review",
    );
  });

  it("omits the url key entirely when no review URL is configured", () => {
    // Discord rejects an embed url of null/empty — the key must be absent,
    // not present-and-falsy.
    const payload = buildRegistrationPayload(base);
    expect("url" in payload.embeds[0]).toBe(false);
  });

  it("sets a color Discord's API will accept", () => {
    const payload = buildRegistrationPayload(base);
    const color = payload.embeds[0].color;
    expect(Number.isInteger(color)).toBe(true);
    expect(color).toBeGreaterThanOrEqual(0);
    expect(color).toBeLessThanOrEqual(16_777_215);
  });

  it("stamps a valid ISO timestamp Discord can render", () => {
    const payload = buildRegistrationPayload(base);
    expect(() => new Date(payload.embeds[0].timestamp)).not.toThrow();
    expect(Number.isNaN(new Date(payload.embeds[0].timestamp).getTime())).toBe(
      false,
    );
  });
});

describe("buildHelpRequestPayload", () => {
  const request = {
    studentId: "SCC-24-0012345",
    fullName: "Juan Miguel Dela Cruz",
    category: "wrong_email" as const,
    requestedEmail: "juan@gmail.com" as string | null,
    message: null as string | null,
    queueUrl: null as string | null,
  };

  it("puts the student, id, and requested email in the embed fields", () => {
    const payload = buildHelpRequestPayload(request);
    const fieldText = payload.embeds[0].fields.map((f) => `${f.name} ${f.value}`).join(" ");

    expect(fieldText).toContain("Juan Miguel Dela Cruz");
    expect(fieldText).toContain("SCC-24-0012345");
    expect(fieldText).toContain("juan@gmail.com");
  });

  it("titles the embed with the category label", () => {
    const payload = buildHelpRequestPayload({ ...request, category: "no_qr", requestedEmail: null });
    expect(payload.embeds[0].title).toBe("I didn't get my QR email");
  });

  it("leaves out the email field when there is none, and adds the message when there is one", () => {
    const payload = buildHelpRequestPayload({
      ...request,
      category: "other",
      requestedEmail: null,
      message: "My name is misspelled.",
    });
    const names = payload.embeds[0].fields.map((f) => f.name);
    expect(names).not.toContain("Requested email");
    expect(names).toContain("Message");
  });

  it("makes the title a clickable link when a queue URL is configured", () => {
    const payload = buildHelpRequestPayload({
      ...request,
      queueUrl: "https://itech2026.site/admin/email-fixes",
    });
    expect(payload.embeds[0].url).toBe("https://itech2026.site/admin/email-fixes");
  });

  it("omits the url key entirely when no queue URL is configured", () => {
    const payload = buildHelpRequestPayload(request);
    expect("url" in payload.embeds[0]).toBe(false);
  });

  it("uses a different color than the new-registration embed, so the two are distinguishable", () => {
    const registrationColor = buildRegistrationPayload({
      fullName: "Juan",
      yearLevel: "3rd year",
      section: "B",
      amountCentavos: 50_000,
      gcashReference: "1234567890123",
      reviewUrl: null,
    }).embeds[0].color;
    const helpColor = buildHelpRequestPayload(request).embeds[0].color;
    expect(helpColor).not.toBe(registrationColor);
  });
});
