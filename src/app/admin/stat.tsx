/**
 * `flex flex-col justify-between` + the grid's default item-stretch (every
 * card in a row is already the same height) is what keeps `value` aligned
 * across a row of cards — without it, a longer `label` that wraps to a
 * second line (e.g. "Admin current collection" next to "Total payments" on
 * /admin/cash) pushes just its own value down, throwing off the row.
 */
export function Stat({
  label,
  value,
  detail,
  negative,
}: {
  label: string;
  value: number | string;
  /** A short line under the value showing how it was derived, e.g. "₱500 collected − ₱200 spent". */
  detail?: string;
  /** True when `value` represents an overspent balance — semantic red, not the theme accent. */
  negative?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-ground/10 bg-ground/5 p-4">
      <dt className="text-sm text-ground/60">{label}</dt>
      <dd
        className={`mt-2 text-3xl font-bold tabular-nums ${negative ? "text-red-300" : "text-ground"}`}
      >
        {value}
      </dd>
      {detail ? <p className="mt-1 text-xs text-ground/50">{detail}</p> : null}
    </div>
  );
}
