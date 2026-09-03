const TONES = {
  green: "bg-green-500/15 text-green-300 border border-green-500/30",
  amber: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  red: "bg-red-500/15 text-red-300 border border-red-500/30",
  slate: "bg-ground/10 text-ground/70 border border-ground/15",
} as const;

/**
 * A small status pill. Semantic-only — green/amber/red for status, never
 * the theme accent for meaning — on the dark bg-deep admin shell.
 */
export function Badge({
  tone,
  children,
}: {
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
