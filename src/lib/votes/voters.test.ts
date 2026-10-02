import { describe, expect, it } from "vitest";
import { findVoter, namesMatch, normalizeName, type Voter } from "./voters";

const voters: Voter[] = [
  { registrationId: "1", fullName: "Juan Miguel Dela Cruz", yearLevel: "3rd Year", section: "B", email: "juan@example.com" },
  { registrationId: "2", fullName: "Juana Reyes", yearLevel: "2nd Year", section: "A", email: "juana@example.com" },
  { registrationId: "3", fullName: "María Santos", yearLevel: "1st Year", section: "C", email: "maria@example.com" },
  { registrationId: "4", fullName: "Juan Miguel Dela Cruz", yearLevel: "4th Year", section: "A", email: "other@example.com" },
  { registrationId: "5", fullName: "Cruz, Ana B.", yearLevel: "1st Year", section: "A", email: "ana@example.com" },
];

describe("normalizeName", () => {
  it("ignores case, accents, punctuation and spacing", () => {
    expect(normalizeName("  Santos,   MARÍA  S. ")).toBe("santos maria s");
  });
});

describe("namesMatch", () => {
  it("accepts First Middle Last", () => {
    expect(namesMatch("Juan Miguel Dela Cruz", "Juan Miguel Dela Cruz")).toBe(true);
  });

  it("accepts First M. Last", () => {
    expect(namesMatch("Juan M. Dela Cruz", "Juan Miguel Dela Cruz")).toBe(true);
  });

  it("accepts Last, First M.", () => {
    expect(namesMatch("Dela Cruz, Juan M.", "Juan Miguel Dela Cruz")).toBe(true);
  });

  it("accepts a name with no middle name", () => {
    expect(namesMatch("Santos, Maria", "María Santos")).toBe(true);
    expect(namesMatch("Maria Santos", "María Santos")).toBe(true);
  });

  it("reads a registration that was itself typed Last, First", () => {
    expect(namesMatch("Ana B. Cruz", "Cruz, Ana B.")).toBe(true);
    expect(namesMatch("Cruz, Ana", "Cruz, Ana B.")).toBe(true);
  });

  it("accepts a typed middle name when only an initial was registered", () => {
    expect(namesMatch("Ana Beatriz Cruz", "Cruz, Ana B.")).toBe(true);
  });

  it("refuses a wrong word, a wrong initial or someone else's name", () => {
    expect(namesMatch("Juan Pedro Dela Cruz", "Juan Miguel Dela Cruz")).toBe(false);
    expect(namesMatch("Juan P. Dela Cruz", "Juan Miguel Dela Cruz")).toBe(false);
    expect(namesMatch("Juana Reyes", "Juan Miguel Dela Cruz")).toBe(false);
  });

  it("needs a first and a last name", () => {
    expect(namesMatch("Juan", "Juan Miguel Dela Cruz")).toBe(false);
    expect(namesMatch("J M", "Juan Miguel Dela Cruz")).toBe(false);
    expect(namesMatch("  ", "Juan Miguel Dela Cruz")).toBe(false);
  });

  it("doesn't let one registered word answer for two typed words", () => {
    expect(namesMatch("Cruz Cruz", "Juan Dela Cruz")).toBe(false);
  });
});

describe("findVoter", () => {
  it("matches the typed name and the registered email", () => {
    expect(findVoter(voters, "Juan Miguel Dela Cruz", "juan@example.com")?.registrationId).toBe("1");
  });

  it("tells two people with the same name apart by their email", () => {
    expect(findVoter(voters, "Dela Cruz, Juan M.", "other@example.com")?.registrationId).toBe("4");
  });

  it("ignores case and spacing in what was typed", () => {
    expect(findVoter(voters, "juan  miguel dela cruz", "  JUAN@Example.com ")?.registrationId).toBe("1");
  });

  it("refuses an email that belongs to a different name", () => {
    expect(findVoter(voters, "Juana Reyes", "juan@example.com")).toBeNull();
  });

  it("refuses a name that isn't on the list", () => {
    expect(findVoter(voters, "Pedro Penduko", "juan@example.com")).toBeNull();
  });

  it("refuses a blank email", () => {
    expect(findVoter(voters, "Juan Miguel Dela Cruz", "")).toBeNull();
  });
});
