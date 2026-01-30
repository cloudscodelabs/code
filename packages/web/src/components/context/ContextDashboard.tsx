import { useSettingsStore } from '../../stores/settings-store.js';
import { BudgetMeter } from './BudgetMeter.js';

export function ContextDashboard() {
  const budget = useSettingsStore((s) => s.contextBudget);

  if (!budget) {
    return (
      <div className="p-4 text-sm text-zinc-500">
        No context data yet. Send a message to start tracking.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
          Token Usage
        </h3>
        <BudgetMeter
          label="Total Tokens"
          value={budget.totalTokens}
          max={200000}
          format={(v) => v.toLocaleString()}
        />
        <BudgetMeter
          label="Cost"
          value={budget.costUsd}
          max={budget.maxBudgetUsd ?? 5}
          format={(v) => `$${v.toFixed(4)}`}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          Breakdown
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat label="Input" value={budget.inputTokens.toLocaleString()} />
          <Stat label="Output" value={budget.outputTokens.toLocaleString()} />
          <Stat label="Cache Read" value={budget.cacheReadTokens.toLocaleString()} />
          <Stat label="Cache Write" value={budget.cacheWriteTokens.toLocaleString()} />
        </div>
      </div>

      {budget.agentBreakdown.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
            Per Agent
          </h3>
          <div className="space-y-1">
            {budget.agentBreakdown.map((agent) => (
              <div key={agent.agentId} className="flex justify-between text-xs">
                <span className="text-zinc-400">{agent.agentType}</span>
                <span className="text-zinc-500">${agent.costUsd.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 rounded px-2 py-1.5">
      <div className="text-zinc-600">{label}</div>
      <div className="text-zinc-300 font-mono">{value}</div>
    </div>
  );
}
