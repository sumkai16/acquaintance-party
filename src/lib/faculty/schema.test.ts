import { describe, expect, it } from "vitest";
import { facultyEntrySchema } from "./schema";

function parse(input: { fullName: string; department?: string; acknowledged?: boolean }) {
  return facultyEntrySchema.safeParse({
    department: "",
    acknowledged: true,
    ...input,
  });
}

describe("facultyEntrySchema", () => {
  it("accepts a name and a department", () => {
    const result = parse({ fullName: "  Juana D. Santos ", department: " BSIT " });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      fullName: "Juana D. Santos",
      department: "BSIT",
      acknowledged: true,
    });
  });

  it("turns a blank department into null rather than an empty string", () => {
    // Otherwise the adviser's list renders an empty line instead of an em dash.
    expect(parse({ fullName: "Juana D. Santos" }).data?.department).toBeNull();
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
