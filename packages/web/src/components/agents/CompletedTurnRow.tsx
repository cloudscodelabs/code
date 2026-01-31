import { useState } from 'react';
import { StatusIcon, ModelBadge, agentLabels, formatDuration } from './agent-utils.js';
import { ChevronRight, ChevronDown, Wrench, Clock, DollarSign } from 'lucide-react';
import type { AgentToolActivity } from '@cloudscode/shared';
import type { Turn } from './agent-utils.js';

function buildSummary(turn: Turn): string {
  const orc = turn.orchestrator;

  // Use orchestrator resultSummary if available
  if (orc.resultSummary) {
    return orc.resultSummary.length > 80
      ? orc.resultSummary.slice(0, 80) + '...'
      : orc.resultSummary;
  }

  // Fallback: derive from child agent types
  if (turn.children.length > 0) {
    const parts = turn.children.map((c) => {
      const label = agentLabels[c.type] ?? c.type;
      switch (c.type) {
        case 'code-analyst': return 'Analyzed code';
        case 'implementer': return 'Implemented changes';
        case 'test-runner': return 'Ran tests';
        case 'researcher': return 'Researched';
        default: return label;
      }
    });
    const text = parts.join(' + ');
    return text.length > 80 ? text.slice(0, 80) + '...' : text;
  }

  return 'Orchestrator turn';
}

function statusSuffix(status: string): string {
  if (status === 'failed') return ' (failed)';
  if (status === 'interrupted') return ' (interrupted)';
  return '';
}

export function CompletedTurnRow({
  turn,
  toolActivity,
  onSelectAgent,
}: {
  turn: Turn;
  toolActivity: AgentToolActivity[];
  onSelectAgent: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const allAgentIds = new Set([turn.orchestrator.id, ...turn.children.map((c) => c.id)]);
  const turnTools = toolActivity.filter((t) => allAgentIds.has(t.agentId));
  const toolCount = turnTools.length;

  const totalCost =
    turn.orchestrator.costUsd + turn.children.reduce((sum, c) => sum + c.costUsd, 0);

  const totalDuration = turn.orchestrator.durationMs ?? 0;

  const summary = buildSummary(turn) + statusSuffix(turn.orchestrator.status);

  return (
    <div>
      {/* Collapsed summary line */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 w-full text-left rounded hover:bg-zinc-800/50 transition-colors group"
      >
        <StatusIcon status={turn.orchestrator.status} />
        <span className="text-xs text-zinc-300 truncate flex-1">{summary}</span>

        {toolCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-zinc-500 shrink-0">
            <Wrench size={9} />
            {toolCount}
          </span>
        )}
        {totalDuration > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-zinc-500 shrink-0">
            <Clock size={9} />
            {formatDuration(totalDuration)}
          </span>
        )}
        {totalCost > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-zinc-500 shrink-0">
            <DollarSign size={9} />
            ${totalCost.toFixed(4)}
          </span>
        )}

        {expanded ? (
          <ChevronDown size={12} className="text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-zinc-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>

      {/* Expanded: list of agents in this turn */}
      {expanded && (
        <div className="ml-5 border-l border-zinc-800 pl-2 mb-1">
          {[turn.orchestrator, ...turn.children].map((agent) => (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className="flex items-center gap-2 px-2 py-1.5 w-full text-left rounded hover:bg-zinc-800/50 transition-colors"
            >
              <StatusIcon status={agent.status} />
              <span className="text-xs text-zinc-300 truncate">
                {agentLabels[agent.type] ?? agent.type}
              </span>
              <ModelBadge model={agent.model} />
              {agent.costUsd > 0 && (
                <span className="text-[10px] text-zinc-500 ml-auto shrink-0">
                  ${agent.costUsd.toFixed(4)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
