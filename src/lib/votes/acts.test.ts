import { describe, expect, it } from "vitest";
import { actInitials } from "./acts";

describe("actInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(actInitials("Burnout Band")).toBe("BB");
    expect(actInitials("Lovely Yungod")).toBe("LY");
  });

  it("skips small words, so Six of Seven is SS and not SO", () => {
    expect(actInitials("Six of Seven")).toBe("SS");
    expect(actInitials("The Rising Sun")).toBe("RS");
  });

  it("takes the first two characters of a one-word name", () => {
    expect(actInitials("H4NZO")).toBe("H4");
  });

  it("is uppercase and ignores extra spaces", () => {
    expect(actInitials("  nap   batoon ")).toBe("NB");
  });

  it("never returns an empty badge", () => {
    expect(actInitials("")).toBe("?");
  });
});
