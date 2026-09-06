export function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-ground/10 bg-ground/5 p-4">
      <dt className="text-sm text-ground/60">{label}</dt>
      <dd className="text-3xl font-bold tabular-nums text-ground">
        {value}
      </dd>
    </div>
  );
}
