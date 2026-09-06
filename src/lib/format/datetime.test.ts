import { describe, expect, it } from "vitest";
import { formatDatePH, formatDateTimePH, formatTimePH } from "./datetime";

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
