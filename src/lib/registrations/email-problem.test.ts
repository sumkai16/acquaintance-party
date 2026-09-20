import { describe, expect, it } from "vitest";
import { emailProblem } from "./schema";

describe("emailProblem", () => {
  it("says nothing for an empty or valid address", () => {
    expect(emailProblem("")).toBeNull();
    expect(emailProblem("juan@gmail.com")).toBeNull();
    expect(emailProblem("axceelñ@gmail.com")).toBeNull();
  });

  it("flags a half-typed address with no fix", () => {
    expect(emailProblem("juan@g")).toEqual({
      message: "Enter a valid email address.",
      fix: null,
    });
  });

  it("offers the corrected address for a mistyped provider", () => {
    const problem = emailProblem("juan@gamil.com");
    expect(problem?.fix).toBe("juan@gmail.com");
  });
});
