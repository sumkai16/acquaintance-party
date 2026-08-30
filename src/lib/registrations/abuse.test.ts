import { describe, expect, it } from "vitest";
import {
  THROTTLE_MAX_SUBMISSIONS,
  THROTTLE_WINDOW_MINUTES,
  isThrottled,
  throttleWindowStart,
} from "./abuse";

describe("throttleWindowStart", () => {
  it("looks back exactly the configured window", () => {
    const now = new Date("2026-09-01T12:00:00.000Z");
    const start = new Date(throttleWindowStart(now));
    const minutesBack = (now.getTime() - start.getTime()) / 60_000;
    expect(minutesBack).toBe(THROTTLE_WINDOW_MINUTES);
  });

  it("returns an ISO string Postgres can compare", () => {
    const start = throttleWindowStart(new Date("2026-09-01T12:00:00.000Z"));
    expect(start).toBe("2026-09-01T11:45:00.000Z");
  });
});

describe("isThrottled", () => {
  it("allows a first submission", () => {
    expect(isThrottled(0)).toBe(false);
  });

  it("allows submissions up to the limit, since retries are legitimate", () => {
    expect(isThrottled(THROTTLE_MAX_SUBMISSIONS - 1)).toBe(false);
  });

  it("blocks once the limit is reached", () => {
    expect(isThrottled(THROTTLE_MAX_SUBMISSIONS)).toBe(true);
    expect(isThrottled(THROTTLE_MAX_SUBMISSIONS + 10)).toBe(true);
  });
});
