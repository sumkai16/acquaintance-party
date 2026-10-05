import { describe, expect, it } from "vitest";
import { analyzeText, isNoAnswer, normalize } from "./text-analysis";

describe("isNoAnswer", () => {
  it.each([
    "None",
    "N/A",
    "n/a.",
    "Wala",
    "wala po",
    "No comment",
    "nothing!",
    "  ",
    "-",
  ])("treats %j as no answer", (answer) => {
    expect(isNoAnswer(answer)).toBe(true);
  });

  it.each([
    "none of the food was enough",
    "Battle of the band",
    "more food haha",
  ])("keeps %j as a real answer", (answer) => {
    expect(isNoAnswer(answer)).toBe(false);
  });
});

describe("normalize", () => {
  it("drops punctuation and case", () => {
    expect(normalize("  N/A!! ")).toBe("na");
  });
});

describe("analyzeText", () => {
  const answers = [
    "Battle of the band",
    "battle of the bands",
    "BATTLE OF THE BANDS/AFTER PARTY",
    "raffle",
    "Raffle!",
    "None",
    "wala",
    "N/A",
  ];

  it("counts totals and non-answers", () => {
    const stats = analyzeText(answers);
    expect(stats.total).toBe(8);
    expect(stats.noAnswer).toBe(3);
    expect(stats.answered).toBe(5);
  });

  it("ranks words by how many people used them, merging plurals", () => {
    const stats = analyzeText(answers);
    // Tied counts sort alphabetically, so "band" comes before "battle".
    expect(stats.topTerms.slice(0, 2)).toEqual([
      { term: "band", count: 3 },
      { term: "battle", count: 3 },
    ]);
    expect(stats.topTerms).toContainEqual({ term: "raffle", count: 2 });
  });

  it("counts a word once per answer", () => {
    const stats = analyzeText(["food food food", "food"]);
    expect(stats.topTerms).toEqual([{ term: "food", count: 2 }]);
  });

  it("ignores stopwords and words used only once", () => {
    const stats = analyzeText(["the party was great", "the food was good"]);
    expect(stats.topTerms).toEqual([]);
  });

  it("handles an empty list", () => {
    expect(analyzeText([])).toEqual({
      total: 0,
      noAnswer: 0,
      answered: 0,
      topTerms: [],
    });
  });
});
