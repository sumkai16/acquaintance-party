import { describe, expect, it } from "vitest";
import { buildSectionReport } from "./section-report";

describe("buildSectionReport", () => {
  it("covers every canonical section for every year level, even with zero registrations", () => {
    const report = buildSectionReport([]);
    const first = report.find((r) => r.yearLevel === "1st year")!;
    const second = report.find((r) => r.yearLevel === "2nd year")!;
    const third = report.find((r) => r.yearLevel === "3rd year")!;
    const fourth = report.find((r) => r.yearLevel === "4th year")!;

    expect(first.sections.map((s) => s.section)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    expect(second.sections.map((s) => s.section)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
    ]);
    expect(third.sections.map((s) => s.section)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(fourth.sections.map((s) => s.section)).toEqual(["A", "B", "C", "D"]);

    for (const year of report) {
      for (const section of year.sections) {
        expect(section.count).toBe(0);
        expect(section.totalCentavos).toBe(0);
      }
    }
  });

  it("counts and sums registrations into their matching section", () => {
    const report = buildSectionReport([
      { year_level: "4th year", section: "A", amount: 49500 },
      { year_level: "4th year", section: "A", amount: 49500 },
      { year_level: "4th year", section: "B", amount: 49500 },
    ]);
    const fourth = report.find((r) => r.yearLevel === "4th year")!;
    const sectionA = fourth.sections.find((s) => s.section === "A")!;
    const sectionB = fourth.sections.find((s) => s.section === "B")!;
    const sectionC = fourth.sections.find((s) => s.section === "C")!;

    expect(sectionA).toEqual({ section: "A", count: 2, totalCentavos: 99000 });
    expect(sectionB).toEqual({ section: "B", count: 1, totalCentavos: 49500 });
    expect(sectionC).toEqual({ section: "C", count: 0, totalCentavos: 0 });
  });

  it("matches section case- and whitespace-insensitively", () => {
    const report = buildSectionReport([
      { year_level: "1st year", section: " a ", amount: 49500 },
    ]);
    const first = report.find((r) => r.yearLevel === "1st year")!;
    const sectionA = first.sections.find((s) => s.section === "A")!;
    expect(sectionA).toEqual({ section: "A", count: 1, totalCentavos: 49500 });
    expect(first.sections.find((s) => s.section === "Other")).toBeUndefined();
  });

  it("buckets an unrecognized section under Other rather than dropping it", () => {
    const report = buildSectionReport([
      { year_level: "4th year", section: "BSIT-4Z", amount: 49500 },
    ]);
    const fourth = report.find((r) => r.yearLevel === "4th year")!;
    const other = fourth.sections.find((s) => s.section === "Other");
    expect(other).toEqual({ section: "Other", count: 1, totalCentavos: 49500 });
  });

  it("omits the Other row entirely when every registration matches a canonical section", () => {
    const report = buildSectionReport([
      { year_level: "2nd year", section: "C", amount: 49500 },
    ]);
    const second = report.find((r) => r.yearLevel === "2nd year")!;
    expect(second.sections.find((s) => s.section === "Other")).toBeUndefined();
  });
});
