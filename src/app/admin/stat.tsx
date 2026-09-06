/**
 * `flex flex-col justify-between` + the grid's default item-stretch (every
 * card in a row is already the same height) is what keeps `value` aligned
 * across a row of cards — without it, a longer `label` that wraps to a
 * second line (e.g. "Admin current collection" next to "Total payments" on
 * /admin/cash) pushes just its own value down, throwing off the row.
 */
export function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-ground/10 bg-ground/5 p-4">
      <dt className="text-sm text-ground/60">{label}</dt>
      <dd className="mt-2 text-3xl font-bold tabular-nums text-ground">
        {value}
      </dd>
    </div>
  );
}
