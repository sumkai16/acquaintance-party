const TONES = {
  green: "bg-green-100 text-green-900",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-900",
  slate: "bg-slate-200 text-slate-800",
} as const;

/**
 * A small status pill in the app's neutral/semantic admin palette — never
 * the theme accent (context/DESIGN.md §5). Shared shape for anything that
 * shows a status at a glance: scan results, registration status.
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
