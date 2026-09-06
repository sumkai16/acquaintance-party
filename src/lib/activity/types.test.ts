import { describe, expect, it } from "vitest";
import { ACTIVITY_TYPES, describeActivity } from "./types";

describe("describeActivity", () => {
  it("has a human label for every declared activity type", () => {
    for (const type of ACTIVITY_TYPES) {
      expect(describeActivity(type).length).toBeGreaterThan(0);
    }
  });

  it("labels a walk-in payment the way staff and admin both see it", () => {
    expect(describeActivity("walk_in_payment_added")).toBe("Walk-in Payment Added");
  });

  it("labels login and logout distinctly", () => {
    expect(describeActivity("login")).toBe("Login");
    expect(describeActivity("logout")).toBe("Logout");
  });
});
