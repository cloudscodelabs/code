import { useSettingsStore } from '../../stores/settings-store.js';
import { BudgetMeter } from './BudgetMeter.js';

export function ContextDashboard() {
  const budget = useSettingsStore((s) => s.contextBudget);

  if (!budget) {
    return (
      <div className="p-6 text-sm text-zinc-500">
        No context data yet. Send a message to start tracking.
      </div>
    );
  }

  const totalAllTokens = budget.inputTokens + budget.outputTokens + budget.cacheReadTokens + budget.cacheWriteTokens;
  const pct = (v: number) => totalAllTokens > 0 ? ((v / totalAllTokens) * 100).toFixed(1) : '0.0';

  return (
    <div className="p-6 space-y-6">
      {/* Summary */}
      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
          Summary
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

      {/* Token Breakdown */}
      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
          Token Breakdown
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <TokenStat
            label="Input"
            value={budget.inputTokens}
            percentage={pct(budget.inputTokens)}
            color="text-blue-400"
          />
          <TokenStat
            label="Output"
            value={budget.outputTokens}
            percentage={pct(budget.outputTokens)}
            color="text-green-400"
          />
          <TokenStat
            label="Cache Read"
            value={budget.cacheReadTokens}
            percentage={pct(budget.cacheReadTokens)}
            color="text-amber-400"
          />
          <TokenStat
            label="Cache Write"
            value={budget.cacheWriteTokens}
            percentage={pct(budget.cacheWriteTokens)}
            color="text-purple-400"
          />
        </div>
      </div>

      {/* Per-Agent Breakdown */}
      {budget.agentBreakdown.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
            Per Agent
          </h3>
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-800/50">
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium">Agent</th>
                  <th className="text-right px-3 py-2 text-zinc-500 font-medium">Input</th>
                  <th className="text-right px-3 py-2 text-zinc-500 font-medium">Output</th>
                  <th className="text-right px-3 py-2 text-zinc-500 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {budget.agentBreakdown.map((agent) => (
                  <tr key={agent.agentId} className="border-t border-zinc-800/50">
                    <td className="px-3 py-2 text-zinc-300">{agent.agentType}</td>
                    <td className="px-3 py-2 text-right text-zinc-400 font-mono">
                      {agent.inputTokens.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-400 font-mono">
                      {agent.outputTokens.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-400 font-mono">
                      ${agent.costUsd.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TokenStat({ label, value, percentage, color }: { label: string; value: number; percentage: string; color: string }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5">
      <div className="text-zinc-500 text-xs mb-1">{label}</div>
      <div className="text-zinc-200 font-mono text-sm">{value.toLocaleString()}</div>
      <div className={`text-xs mt-0.5 ${color}`}>{percentage}%</div>
    </div>
  );
}
