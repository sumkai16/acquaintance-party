import { describe, expect, it } from "vitest";
import { readOpenFlag } from "./open";

describe("readOpenFlag", () => {
  it("treats exactly \"true\" as open", () => {
    expect(readOpenFlag("true")).toBe(true);
  });

  it("treats \"false\" as closed", () => {
    expect(readOpenFlag("false")).toBe(false);
  });

  it("treats a missing row as closed — fail-closed, not fail-open", () => {
    expect(readOpenFlag(null)).toBe(false);
  });

  it("treats any other value as closed", () => {
    expect(readOpenFlag("TRUE")).toBe(false);
    expect(readOpenFlag("1")).toBe(false);
    expect(readOpenFlag("yes")).toBe(false);
    expect(readOpenFlag("")).toBe(false);
  });
});
