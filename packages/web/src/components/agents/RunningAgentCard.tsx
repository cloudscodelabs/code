import { StatusIcon, ModelBadge, agentLabels } from './agent-utils.js';
import { useElapsedTime } from '../../hooks/useElapsedTime.js';
import { Loader2, Square, DollarSign, Clock, Wrench } from 'lucide-react';
import type { AgentNode, AgentToolActivity } from '@cloudscode/shared';
import { wsClient } from '../../lib/ws-client.js';

export function RunningAgentCard({
  agent,
  currentTool,
  recentTools,
  onSelect,
}: {
  agent: AgentNode;
  currentTool?: AgentToolActivity;
  recentTools: AgentToolActivity[];
  onSelect: () => void;
}) {
  const elapsed = useElapsedTime(agent.startedAt);

  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-lg bg-zinc-800/60 border-l-2 border-blue-500 px-3 py-2.5 hover:bg-zinc-800 transition-colors"
    >
      {/* Header: status + label + model + stop */}
      <div className="flex items-center gap-2 mb-1">
        <StatusIcon status={agent.status} />
        <span className="text-sm font-medium text-zinc-200 truncate">
          {agentLabels[agent.type] ?? agent.type}
        </span>
        <ModelBadge model={agent.model} />
        {agent.type !== 'orchestrator' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              wsClient.send({ type: 'agent:interrupt', payload: { agentId: agent.id } });
            }}
            className="ml-auto p-0.5 rounded hover:bg-red-900/50 transition-colors shrink-0"
            title="Stop this agent"
          >
            <Square size={12} className="text-red-400" />
          </button>
        )}
      </div>

      {/* Task description */}
      {agent.taskDescription && (
        <p className="text-xs text-zinc-400 mb-1.5 line-clamp-2">{agent.taskDescription}</p>
      )}

      {/* Stats row: elapsed + cost */}
      <div className="flex items-center gap-3 text-xs text-zinc-500 mb-1.5">
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {elapsed}
        </span>
        {agent.costUsd > 0 && (
          <span className="flex items-center gap-1">
            <DollarSign size={10} />
            ${agent.costUsd.toFixed(4)}
          </span>
        )}
      </div>

      {/* Current tool */}
      {currentTool && currentTool.status === 'running' && (
        <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-1">
          <Loader2 size={10} className="animate-spin shrink-0" />
          <span className="truncate">{currentTool.toolName}</span>
        </div>
      )}

      {/* Recent completed tools (last 3) */}
      {recentTools.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {recentTools.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-zinc-700/60 text-zinc-400"
            >
              <Wrench size={9} />
              {t.toolName}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
