import { describe, expect, it } from "vitest";
import { MAX_DRAFT_ROWS, sanitizeDraftRows } from "./sanitize";

const row = {
  id: "a1",
  fullName: "Maria Santos",
  studentId: "SCC-24-0012345",
  yearLevel: "2nd year",
  section: "B",
  email: "maria@gmail.com",
};

describe("sanitizeDraftRows", () => {
  it("keeps a well-formed row as it is", () => {
    expect(sanitizeDraftRows([row])).toEqual([row]);
  });

  it.each([null, undefined, "rows", 42, {}, { length: 3 }])(
    "returns nothing for input that isn't an array: %j",
    (input) => {
      expect(sanitizeDraftRows(input)).toEqual([]);
    },
  );

  it("skips entries that aren't objects", () => {
    expect(sanitizeDraftRows([null, "x", 7, row])).toEqual([row]);
  });

  it("strips keys it doesn't know about", () => {
    const [kept] = sanitizeDraftRows([{ ...row, isAdmin: true, open: true, serverError: "x" }]);
    expect(Object.keys(kept).sort()).toEqual(
      ["email", "fullName", "id", "section", "studentId", "yearLevel"].sort(),
    );
  });

  it("turns non-string values into empty strings", () => {
    const [kept] = sanitizeDraftRows([{ ...row, section: 5, email: { a: 1 } }]);
    expect(kept.section).toBe("");
    expect(kept.email).toBe("");
  });

  it("cuts an oversized value instead of storing it", () => {
    const [kept] = sanitizeDraftRows([{ ...row, fullName: "a".repeat(5000) }]);
    expect(kept.fullName).toHaveLength(120);
  });

  it("drops a row with nothing typed in it", () => {
    expect(sanitizeDraftRows([{ id: "b", fullName: "  ", studentId: "", email: "" }])).toEqual([]);
  });

  it("keeps at most the row cap", () => {
    const many = Array.from({ length: MAX_DRAFT_ROWS + 50 }, (_, i) => ({
      ...row,
      id: String(i),
    }));
    expect(sanitizeDraftRows(many)).toHaveLength(MAX_DRAFT_ROWS);
  });
});
