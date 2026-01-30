interface BudgetMeterProps {
  label: string;
  value: number;
  max: number;
  format: (v: number) => string;
}

export function BudgetMeter({ label, value, max, format }: BudgetMeterProps) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : 'bg-blue-500';

  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-300 font-mono">{format(value)}</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
