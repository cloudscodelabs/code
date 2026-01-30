import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { AgentNode } from '@cloudscode/shared';

interface AgentActivityCardProps {
  agent: AgentNode;
}

const statusIcons = {
  running: <Loader2 size={14} className="animate-spin text-blue-400" />,
  completed: <CheckCircle2 size={14} className="text-green-400" />,
  failed: <XCircle size={14} className="text-red-400" />,
  idle: null,
  interrupted: <XCircle size={14} className="text-yellow-400" />,
};

const agentLabels: Record<string, string> = {
  'code-analyst': 'Code Analyst',
  'implementer': 'Implementer',
  'test-runner': 'Test Runner',
  'researcher': 'Researcher',
  'orchestrator': 'Orchestrator',
};

export function AgentActivityCard({ agent }: AgentActivityCardProps) {
  const [expanded, setExpanded] = useState(agent.status === 'running');

  return (
    <div className="mx-10 rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-800/50 transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {statusIcons[agent.status]}
        <span className="text-zinc-300 font-medium">
          {agentLabels[agent.type] ?? agent.type}
        </span>
        <span className="text-xs text-zinc-500 ml-auto">
          {agent.status === 'running' && 'running...'}
          {agent.status === 'completed' && agent.durationMs && `${(agent.durationMs / 1000).toFixed(1)}s`}
          {agent.status === 'failed' && 'failed'}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-2 text-xs text-zinc-400 border-t border-zinc-800/50">
          {agent.resultSummary ? (
            <p className="mt-2 whitespace-pre-wrap">{agent.resultSummary}</p>
          ) : agent.status === 'running' ? (
            <p className="mt-2 text-zinc-500 italic">Working...</p>
          ) : null}
          {agent.costUsd > 0 && (
            <p className="mt-1 text-zinc-600">
              Cost: ${agent.costUsd.toFixed(4)} | Tokens: {agent.tokens.toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
