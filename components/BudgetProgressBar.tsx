type BudgetProgressBarProps = {
  spent: number;
  limit: number;
};

function barColor(ratio: number): string {
  if (ratio >= 1) return "bg-red-500";
  if (ratio >= 0.8) return "bg-amber-400";
  return "bg-emerald-500";
}

export function BudgetProgressBar({ spent, limit }: BudgetProgressBarProps) {
  const ratio = limit > 0 ? spent / limit : 0;
  const widthPct = Math.min(ratio * 100, 100);

  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200"
      role="progressbar"
      aria-valuenow={Math.round(widthPct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${barColor(ratio)}`}
        style={{ width: `${widthPct}%` }}
      />
    </div>
  );
}
