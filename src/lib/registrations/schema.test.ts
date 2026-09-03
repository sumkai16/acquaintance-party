import { describe, expect, it } from "vitest";
import { checkoutSchema, walkInSchema } from "./schema";

const valid = {
  fullName: "Juan Miguel Dela Cruz",
  studentId: "2023-00451",
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

  it("rejects an empty section", () => {
    expect(checkoutSchema.safeParse({ ...valid, section: "   " }).success).toBe(
      false,
    );
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
    const parsed = checkoutSchema.parse({ ...valid, studentId: "  2023-00451  " });
    expect(parsed.studentId).toBe("2023-00451");
  });

  it("rejects an empty student ID", () => {
    expect(checkoutSchema.safeParse({ ...valid, studentId: "   " }).success).toBe(
      false,
    );
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
});
