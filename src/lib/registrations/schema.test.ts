import { describe, expect, it } from "vitest";
import { checkoutSchema, walkInSchema } from "./schema";

const valid = {
  fullName: "Juan Miguel Dela Cruz",
  studentId: "SCC-23-00000451",
  yearLevel: "3rd year",
  section: "B",
  email: "juan@example.com",
  gcashReference: "1234567890123",
};

describe("checkoutSchema", () => {
  it("accepts a complete, valid submission", () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
  });

  it("normalizes the GCash reference so the unique index sees one form", () => {
    const parsed = checkoutSchema.parse({
      ...valid,
      gcashReference: "1234 5678 90123",
    });
    expect(parsed.gcashReference).toBe("1234567890123");
  });

  it("trims and collapses whitespace in the name", () => {
    const parsed = checkoutSchema.parse({
      ...valid,
      fullName: "  Juan   Miguel  Dela Cruz  ",
    });
    expect(parsed.fullName).toBe("Juan Miguel Dela Cruz");
  });

  it("lowercases the email so duplicates are findable", () => {
    const parsed = checkoutSchema.parse({ ...valid, email: "Juan@Example.COM" });
    expect(parsed.email).toBe("juan@example.com");
  });

  it("rejects a one-character name", () => {
    expect(checkoutSchema.safeParse({ ...valid, fullName: "J" }).success).toBe(
      false,
    );
  });

  it("rejects an unknown year level", () => {
    expect(
      checkoutSchema.safeParse({ ...valid, yearLevel: "7th year" }).success,
    ).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(
      checkoutSchema.safeParse({ ...valid, email: "not-an-email" }).success,
    ).toBe(false);
  });

  // The cap exists so the certificate renderer never has to shrink a name
  // past legibility — see fullName in schema.ts.
  it("accepts a 60-character name", () => {
    expect(
      checkoutSchema.safeParse({ ...valid, fullName: "a".repeat(60) }).success,
    ).toBe(true);
  });

  it("rejects a name past 60 characters", () => {
    expect(
      checkoutSchema.safeParse({ ...valid, fullName: "a".repeat(61) }).success,
    ).toBe(false);
  });

  it("rejects an empty section", () => {
    expect(checkoutSchema.safeParse({ ...valid, section: "   " }).success).toBe(
      false,
    );
  });

  it("normalizes a section so one section is one string in the report", () => {
    const parsed = checkoutSchema.parse({ ...valid, section: "  b  " });
    expect(parsed.section).toBe("B");
  });

  it("rejects a section the chosen year level does not have", () => {
    // 4th year stops at D; G is a 1st/2nd year section.
    const result = checkoutSchema.safeParse({
      ...valid,
      yearLevel: "4th year",
      section: "G",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue.path).toEqual(["section"]);
      expect(issue.message).toBe("4th year has no section G.");
    }
  });

  it("accepts the same section under a year level that does have it", () => {
    expect(
      checkoutSchema.safeParse({ ...valid, yearLevel: "1st year", section: "G" })
        .success,
    ).toBe(true);
  });

  it("rejects a section outside the lettered scheme entirely", () => {
    expect(
      checkoutSchema.safeParse({ ...valid, section: "BSIT-3Z" }).success,
    ).toBe(false);
  });

  it("reports a missing year level rather than the pair mismatch", () => {
    const result = checkoutSchema.safeParse({ ...valid, yearLevel: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual([
        "Choose your year level.",
      ]);
    }
  });

  it("rejects a reference that is not thirteen digits", () => {
    expect(
      checkoutSchema.safeParse({ ...valid, gcashReference: "12345" }).success,
    ).toBe(false);
  });

  it("explains a bad reference in words a student can act on", () => {
    const result = checkoutSchema.safeParse({
      ...valid,
      gcashReference: "12345",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/13 digits/i);
    }
  });

  it("explains a bad year level without leaking enum internals", () => {
    const result = checkoutSchema.safeParse({ ...valid, yearLevel: "7th year" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Choose your year level.");
    }
  });

  it("trims the student ID", () => {
    const parsed = checkoutSchema.parse({
      ...valid,
      studentId: "  SCC-23-00000451  ",
    });
    expect(parsed.studentId).toBe("SCC-23-00000451");
  });

  it("uppercases the student ID, so case can't split one student into two", () => {
    // registrations_student_id_active_key matches exactly — a lowercase
    // submission would otherwise sit beside the uppercase one in the index
    // and earn a second ticket.
    const parsed = checkoutSchema.parse({ ...valid, studentId: " scc-25-00025380 " });
    expect(parsed.studentId).toBe("SCC-25-00025380");
  });

  it("rejects an empty student ID", () => {
    expect(checkoutSchema.safeParse({ ...valid, studentId: "   " }).success).toBe(
      false,
    );
  });

  it("rejects an ID missing the year segment", () => {
    // The real one that got through and was approved before anyone noticed:
    // SCC-00025420, eight digits but no two-digit entry year. It collides
    // with nothing, so it neither duplicates the student's real ID nor
    // reserves it.
    expect(
      checkoutSchema.safeParse({ ...valid, studentId: "SCC-00025420" }).success,
    ).toBe(false);
  });

  it.each([
    ["a three-digit year", "SCC-253-00025380"],
    ["a seven-digit serial", "SCC-25-0002538"],
    ["a nine-digit serial", "SCC-25-000253800"],
    ["no dashes at all", "SCC2500025380"],
    ["a different school prefix", "ABC-25-00025380"],
    ["trailing characters", "SCC-25-00025380X"],
  ])("rejects %s", (_label, studentId) => {
    expect(checkoutSchema.safeParse({ ...valid, studentId }).success).toBe(false);
  });

  it("accepts the shape every real registration uses", () => {
    // 17 of the 18 registrations taken before this rule existed matched
    // exactly this; the eighteenth was the typo above.
    expect(
      checkoutSchema.safeParse({ ...valid, studentId: "SCC-25-00025380" }).success,
    ).toBe(true);
  });
});

describe("walkInSchema", () => {
  const walkInValid = {
    fullName: valid.fullName,
    studentId: valid.studentId,
    yearLevel: valid.yearLevel,
    section: valid.section,
    email: valid.email,
  };

  it("accepts a submission with no GCash reference", () => {
    expect(walkInSchema.safeParse(walkInValid).success).toBe(true);
  });

  it("still requires a student ID", () => {
    expect(
      walkInSchema.safeParse({ ...walkInValid, studentId: "" }).success,
    ).toBe(false);
  });

  // This is also what guards the Excel bulk import — every row goes through
  // walkInSchema in import-actions.ts, at parse and again at confirm.
  it("rejects a section the year level does not have", () => {
    expect(
      walkInSchema.safeParse({
        ...walkInValid,
        yearLevel: "4th year",
        section: "F",
      }).success,
    ).toBe(false);
  });

  it("accepts a lowercase section from a spreadsheet cell", () => {
    const parsed = walkInSchema.parse({ ...walkInValid, section: "c" });
    expect(parsed.section).toBe("C");
  });
});
