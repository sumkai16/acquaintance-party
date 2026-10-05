import { describe, expect, it } from "vitest";
import { tallyThemes, type AiReading } from "./theme-tally";

const base = { summary: " Most liked the band. ", mood: "positive" as const };

describe("tallyThemes", () => {
  it("counts each theme from its answer numbers, biggest first", () => {
    const reading: AiReading = {
      ...base,
      themes: [
        { label: "Raffle", answer_numbers: [4, 5] },
        { label: "Band battle", answer_numbers: [1, 2, 3] },
      ],
    };
    const result = tallyThemes(reading, 5);
    expect(result.themes).toEqual([
      { label: "Band battle", count: 3 },
      { label: "Raffle", count: 2 },
    ]);
    expect(result.summary).toBe("Most liked the band.");
    expect(result.answers).toBe(5);
  });

  it("counts an answer only once if two themes claim it", () => {
    const result = tallyThemes(
      {
        ...base,
        themes: [
          { label: "A", answer_numbers: [1, 2] },
          { label: "B", answer_numbers: [2, 3] },
        ],
      },
      3,
    );
    expect(result.themes).toEqual([
      { label: "A", count: 2 },
      { label: "B", count: 1 },
    ]);
  });

  it("ignores numbers outside the list and puts missed answers in Other", () => {
    const result = tallyThemes(
      { ...base, themes: [{ label: "A", answer_numbers: [1, 99, 0, 1.5] }] },
      3,
    );
    expect(result.themes).toEqual([
      { label: "Other", count: 2 },
      { label: "A", count: 1 },
    ]);
    expect(result.themes.reduce((sum, t) => sum + t.count, 0)).toBe(3);
  });

  it("drops themes that ended up empty", () => {
    const result = tallyThemes(
      { ...base, themes: [{ label: "Ghost", answer_numbers: [] }] },
      2,
    );
    expect(result.themes).toEqual([{ label: "Other", count: 2 }]);
  });
});
