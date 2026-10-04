export function Bar({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const share = total === 0 ? 0 : (count / total) * 100;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-44 shrink-0 truncate text-ground/70" title={label}>{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ground/10">
        <div className="h-full bg-accent" style={{ width: `${share}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right tabular-nums text-ground/70">
        {count}
      </span>
    </div>
  );
}
