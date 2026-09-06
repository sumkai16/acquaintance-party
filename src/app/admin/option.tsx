/**
 * `[color-scheme:dark]` on the `<select>` itself doesn't reliably force a
 * dark popup for the option list on every OS/browser combo — several admin
 * dropdowns were rendering options as light sand text (`--color-ground`)
 * on the browser's own default white popup, unreadable except for the
 * one row Chrome highlights blue. An explicit inline `background`/`color`
 * on each `<option>` sidesteps that: browsers largely ignore an option's
 * class-based styling for the popup chrome, but do honor an inline style,
 * so this is the one place a raw style prop is the right tool instead of a
 * Tailwind class.
 */
export function Option({
  value,
  disabled,
  children,
}: {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <option
      value={value}
      disabled={disabled}
      style={{ backgroundColor: "var(--color-deep)", color: "var(--color-ground)" }}
    >
      {children}
    </option>
  );
}
