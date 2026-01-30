import { useAgentStore } from '../../stores/agent-store.js';
import { useSettingsStore } from '../../stores/settings-store.js';
import { Loader2, CheckCircle2, XCircle, ExternalLink, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { AgentNode } from '@cloudscode/shared';

const agentLabels: Record<string, string> = {
  'orchestrator': 'Orchestrator',
  'code-analyst': 'Code Analyst',
  'implementer': 'Implementer',
  'test-runner': 'Test Runner',
  'researcher': 'Researcher',
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Loader2 size={12} className="animate-spin text-blue-400" />;
    case 'completed':
      return <CheckCircle2 size={12} className="text-green-400" />;
    case 'failed':
      return <XCircle size={12} className="text-red-400" />;
    default:
      return <div className="w-3 h-3 rounded-full bg-zinc-600" />;
  }
}

function ModelBadge({ model }: { model: string | null }) {
  if (!model) return null;
  return (
    <span className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-700 text-zinc-400 font-medium uppercase">
      {model}
    </span>
  );
}

/** Group agents into turns: each orchestrator + its direct children */
function groupByTurn(agents: AgentNode[]): { orchestrator: AgentNode; children: AgentNode[] }[] {
  const orchestrators = agents
    .filter((a) => a.type === 'orchestrator')
    .sort((a, b) => a.startedAt - b.startedAt);

  return orchestrators.map((orc) => ({
    orchestrator: orc,
    children: agents.filter((a) => a.parentAgentId === orc.id),
  }));
}

export function AgentSummary() {
  const agents = useAgentStore((s) => s.agents);
  const toolActivity = useAgentStore((s) => s.toolActivity);
  const openPanel = useSettingsStore((s) => s.openAgentDetailPanel);
  const [showPrevious, setShowPrevious] = useState(false);

  const agentList = Array.from(agents.values());
  const turns = groupByTurn(agentList);

  const runningTools = toolActivity.filter((t) => t.status === 'running').length;
  const completedTools = toolActivity.filter((t) => t.status === 'completed').length;

  if (agentList.length === 0) {
    return (
      <div className="p-4 text-sm text-zinc-500">
        No agents active. Send a message to start.
      </div>
    );
  }

  const latestTurn = turns[turns.length - 1];
  const previousTurns = turns.slice(0, -1);

  return (
    <div className="p-3 space-y-3">
      {/* Previous turns collapsed */}
      {previousTurns.length > 0 && (
        <button
          onClick={() => setShowPrevious((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          <ChevronRight size={12} className={`transition-transform ${showPrevious ? 'rotate-90' : ''}`} />
          {previousTurns.length} previous turn{previousTurns.length !== 1 ? 's' : ''}
        </button>
      )}

      {showPrevious && previousTurns.map((turn) => (
        <div key={turn.orchestrator.id} className="space-y-1 opacity-60">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-zinc-400">
            <StatusIcon status={turn.orchestrator.status} />
            <span className="truncate">{agentLabels[turn.orchestrator.type] ?? turn.orchestrator.type}</span>
            <ModelBadge model={turn.orchestrator.model} />
          </div>
          {turn.children.map((agent) => (
            <div key={agent.id} className="flex items-center gap-2 px-2 py-1 ml-3 rounded text-sm text-zinc-400">
              <StatusIcon status={agent.status} />
              <span className="truncate">{agentLabels[agent.type] ?? agent.type}</span>
              <ModelBadge model={agent.model} />
            </div>
          ))}
        </div>
      ))}

      {/* Latest turn */}
      {latestTurn && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-zinc-300">
            <StatusIcon status={latestTurn.orchestrator.status} />
            <span className="truncate">{agentLabels[latestTurn.orchestrator.type] ?? latestTurn.orchestrator.type}</span>
            <ModelBadge model={latestTurn.orchestrator.model} />
          </div>
          {latestTurn.children.map((agent) => (
            <div key={agent.id} className="flex items-center gap-2 px-2 py-1.5 ml-3 rounded text-sm text-zinc-300">
              <StatusIcon status={agent.status} />
              <span className="truncate">{agentLabels[agent.type] ?? agent.type}</span>
              <ModelBadge model={agent.model} />
            </div>
          ))}
        </div>
      )}

      {/* Tool counts */}
      {toolActivity.length > 0 && (
        <div className="flex items-center gap-3 px-2 text-xs text-zinc-500">
          {runningTools > 0 && (
            <span className="flex items-center gap-1">
              <Loader2 size={10} className="animate-spin text-blue-400" />
              {runningTools} running
            </span>
          )}
          <span>{completedTools} completed</span>
        </div>
      )}

      {/* Open full panel */}
      <button
        onClick={openPanel}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
      >
        <ExternalLink size={14} />
        View Full Activity
      </button>
    </div>
  );
}
