import { describe, expect, it } from "vitest";
import {
  formatDatePH,
  formatDateTimePH,
  formatTimePH,
  manilaDayBounds,
  shiftDay,
} from "./datetime";

// 2026-09-06T09:42:00Z is 2026-09-06 17:42 in Asia/Manila (UTC+8) — chosen
// deliberately so a bug that forgets the timeZone option (defaulting to the
// server's UTC) produces a visibly different hour, not a coincidentally
// matching one.
const UTC_MORNING = "2026-09-06T09:42:00.000Z";

describe("formatDatePH", () => {
  it("renders the Manila calendar date, not the UTC one", () => {
    expect(formatDatePH(UTC_MORNING)).toBe("Sep 6, 2026");
  });
});

describe("formatTimePH", () => {
  it("renders the Manila wall-clock time", () => {
    expect(formatTimePH(UTC_MORNING)).toBe("5:42 PM");
  });
});

describe("formatDateTimePH", () => {
  it("combines both", () => {
    expect(formatDateTimePH(UTC_MORNING)).toBe("Sep 6, 2026, 5:42 PM");
  });
});

describe("shiftDay", () => {
  it("crosses month and year ends", () => {
    expect(shiftDay("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDay("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("manilaDayBounds", () => {
  it("spans Manila midnight to the next Manila midnight", () => {
    expect(manilaDayBounds("2026-09-30")).toEqual({
      fromIso: "2026-09-30T00:00:00+08:00",
      toIso: "2026-10-01T00:00:00+08:00",
    });
  });

  it("counts 1 AM Manila on the 30th as the 30th, though it's still the 29th in UTC", () => {
    const bounds = manilaDayBounds("2026-09-30")!;
    const earlyMorning = new Date("2026-09-29T17:00:00Z").getTime();
    expect(earlyMorning).toBeGreaterThanOrEqual(new Date(bounds.fromIso).getTime());
    expect(earlyMorning).toBeLessThan(new Date(bounds.toIso).getTime());
  });

  it("rejects dates that don't exist or aren't dates", () => {
    expect(manilaDayBounds("2026-02-30")).toBeNull();
    expect(manilaDayBounds("2026-9-30")).toBeNull();
    expect(manilaDayBounds("yesterday")).toBeNull();
    expect(manilaDayBounds("")).toBeNull();
  });
});
