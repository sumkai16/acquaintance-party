const SMALL_WORDS = new Set(["of", "the", "and", "&"]);

/**
 * The two-letter badge shown in place of an act's photo until one is added
 * (`photo` in src/lib/config/battle.ts): "Burnout Band" → BB, "Six of Seven" →
 * SS, a one-word name like "H4NZO" → H4.
 */
export function actInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const meaningful = words.filter((word) => !SMALL_WORDS.has(word.toLowerCase()));
  const use = meaningful.length > 0 ? meaningful : words;

  if (use.length === 0) return "?";
  if (use.length === 1) return use[0].slice(0, 2).toUpperCase();
  return (use[0][0] + use[1][0]).toUpperCase();
}
