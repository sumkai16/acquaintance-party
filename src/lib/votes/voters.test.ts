import { describe, expect, it } from "vitest";
import { findVoter, matchVoters, normalizeName, type Voter } from "./voters";

const voters: Voter[] = [
  { registrationId: "1", fullName: "Juan Dela Cruz", yearLevel: "3rd Year", section: "B", email: "juan@example.com" },
  { registrationId: "2", fullName: "Juana Reyes", yearLevel: "2nd Year", section: "A", email: "juana@example.com" },
  { registrationId: "3", fullName: "María Santos", yearLevel: "1st Year", section: "C", email: "maria@example.com" },
  { registrationId: "4", fullName: "Juan Dela Cruz", yearLevel: "4th Year", section: "A", email: "other@example.com" },
];

describe("normalizeName", () => {
  it("ignores case, accents and spacing", () => {
    expect(normalizeName("  MARÍA   santos ")).toBe("maria santos");
  });
});

describe("matchVoters", () => {
  it("needs at least two letters", () => {
    expect(matchVoters(voters, "j")).toEqual([]);
    expect(matchVoters(voters, "  ")).toEqual([]);
  });

  it("matches every typed word anywhere in the name, in any order", () => {
    expect(matchVoters(voters, "cruz juan").map((v) => v.registrationId)).toEqual(["1", "4"]);
  });

  it("finds a name typed without its accent", () => {
    expect(matchVoters(voters, "maria").map((v) => v.registrationId)).toEqual(["3"]);
  });

  it("lists names that start with the query before names that merely contain it", () => {
    const containsOnly: Voter = {
      registrationId: "5",
      fullName: "Ana Juan Lopez",
      yearLevel: "1st Year",
      section: "A",
      email: "ana@example.com",
    };
    const list = matchVoters([containsOnly, ...voters], "juan").map((v) => v.registrationId);
    expect(list).toHaveLength(4);
    expect(list[list.length - 1]).toBe("5");
  });

  it("never returns more than the limit", () => {
    expect(matchVoters(voters, "ju", 2)).toHaveLength(2);
  });
});

describe("findVoter", () => {
  it("matches the picked name and the registered email", () => {
    expect(findVoter(voters, "Juan Dela Cruz", "juan@example.com")?.registrationId).toBe("1");
  });

  it("tells two people with the same name apart by their email", () => {
    expect(findVoter(voters, "Juan Dela Cruz", "other@example.com")?.registrationId).toBe("4");
  });

  it("ignores case and spacing in what was typed", () => {
    expect(findVoter(voters, "juan  dela cruz", "  JUAN@Example.com ")?.registrationId).toBe("1");
  });

  it("refuses an email that belongs to a different name", () => {
    expect(findVoter(voters, "Juana Reyes", "juan@example.com")).toBeNull();
  });

  it("refuses a blank email", () => {
    expect(findVoter(voters, "Juan Dela Cruz", "")).toBeNull();
  });
});
