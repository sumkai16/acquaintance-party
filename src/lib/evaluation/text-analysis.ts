/**
 * Plain counts over one written question's answers — no AI, always accurate.
 *
 * Shows how many people gave a non-answer ("none", "n/a", "wala") and which
 * words come up most. It is deliberately simple: the AI summary handles
 * meaning, typos and Taglish; this just counts.
 */

export type TextStats = {
  total: number;
  /** "None", "n/a", "wala", "no comment" and the like. */
  noAnswer: number;
  /** Answers that say something. */
  answered: number;
  /** Words used by the most people, each counted once per answer. */
  topTerms: { term: string; count: number }[];
};

const NO_ANSWER =
  /^(none|na|nil|nothing|nope|no|wala|walang|no comments?|no suggestions?|nothing else|none po|nothing po|no po|wala po|wala naman|wala na|wala pa|wala man|wala akong maisip)$/;

const STOPWORDS = new Set(
  (
    "the and for was were with that this very more are you your have has had but not all can get " +
    "just too also from they them their what when which would could should about into over than then " +
    "will its our out one any some much many like really ang ng sa na mga ko po lang naman yung ung " +
    "pa kasi para mas sana nung may ay at ito iyon din rin pero kung ako ikaw siya kami kayo sila " +
    "ba ni si kay namin natin nila yun yon nga lahat"
  ).split(" "),
);

/**
 * Lowercase, turn punctuation and emoji into spaces, collapse spaces. "N/A!"
 * becomes "na", and "bands/after party" splits into two words, not one.
 */
export function normalize(answer: string): string {
  return answer
    .toLowerCase()
    .replace(/\bn\/a\b/g, "na")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isNoAnswer(answer: string): boolean {
  const text = normalize(answer);
  return text === "" || NO_ANSWER.test(text);
}

/** "bands" and "band" count as one word. */
function stem(word: string): string {
  return word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word;
}

export function analyzeText(answers: string[], topCount = 6): TextStats {
  const counts = new Map<string, number>();
  let noAnswer = 0;

  for (const answer of answers) {
    if (isNoAnswer(answer)) {
      noAnswer += 1;
      continue;
    }
    const seen = new Set<string>();
    for (const word of normalize(answer).split(" ")) {
      if (word.length < 3 || STOPWORDS.has(word) || /^\d+$/.test(word)) continue;
      seen.add(stem(word));
    }
    for (const word of seen) counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const topTerms = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topCount)
    .map(([term, count]) => ({ term, count }));

  return {
    total: answers.length,
    noAnswer,
    answered: answers.length - noAnswer,
    topTerms,
  };
}
