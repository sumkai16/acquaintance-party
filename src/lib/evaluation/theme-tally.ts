/**
 * Turns the model's "these numbered answers belong to this theme" lists into
 * counts. Kept apart from the API call so it is plain, testable code.
 */
export type AiReading = {
  summary: string;
  mood: "positive" | "mixed" | "negative" | "neutral";
  themes: { label: string; answer_numbers: number[] }[];
};

export type AiSummary = {
  summary: string;
  mood: AiReading["mood"];
  /** Biggest first. Counts add up to the number of answers read. */
  themes: { label: string; count: number }[];
  answers: number;
};

/** Counts from the model's lists, ignoring bad or repeated numbers. */
export function tallyThemes(reading: AiReading, answerCount: number): AiSummary {
  const claimed = new Set<number>();
  const themes = reading.themes
    .map((theme) => {
      let count = 0;
      for (const number of theme.answer_numbers) {
        if (!Number.isInteger(number) || number < 1 || number > answerCount) continue;
        if (claimed.has(number)) continue;
        claimed.add(number);
        count += 1;
      }
      return { label: theme.label.trim(), count };
    })
    .filter((theme) => theme.count > 0);

  // Anything the model left out is still an answer someone gave.
  const missed = answerCount - claimed.size;
  if (missed > 0) themes.push({ label: "Other", count: missed });

  themes.sort((a, b) => b.count - a.count);

  return {
    summary: reading.summary.trim(),
    mood: reading.mood,
    themes,
    answers: answerCount,
  };
}
