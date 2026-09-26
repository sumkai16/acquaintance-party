import { describe, expect, it } from "vitest";
import { facultyEntrySchema } from "./schema";

function parse(input: { fullName: string; acknowledged?: boolean }) {
  return facultyEntrySchema.safeParse({
    acknowledged: true,
    ...input,
  });
}

describe("facultyEntrySchema", () => {
  it("accepts a name and trims it", () => {
    const result = parse({ fullName: "  Juana D. Santos " });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      fullName: "Juana D. Santos",
      acknowledged: true,
    });
  });

  it("no longer asks for a department, and drops one if it is sent", () => {
    const result = facultyEntrySchema.safeParse({
      fullName: "Juana D. Santos",
      department: "BSIT",
      acknowledged: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("department");
  });

  it("refuses an unticked acknowledgement", () => {
    const result = parse({ fullName: "Juana D. Santos", acknowledged: false });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["acknowledged"]);
  });

  it("refuses a name that is too short or too long", () => {
    expect(parse({ fullName: "J" }).success).toBe(false);
    expect(parse({ fullName: "x".repeat(121) }).success).toBe(false);
  });
});
