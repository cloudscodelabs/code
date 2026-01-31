import { Loader2, CheckCircle2, XCircle, Wrench } from 'lucide-react';
import type { AgentNode } from '@cloudscode/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const agentLabels: Record<string, string> = {
  'orchestrator': 'Orchestrator',
  'code-analyst': 'Code Analyst',
  'implementer': 'Implementer',
  'test-runner': 'Test Runner',
  'researcher': 'Researcher',
};

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------

export function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Loader2 size={14} className="animate-spin text-blue-400" />;
    case 'completed':
      return <CheckCircle2 size={14} className="text-green-400" />;
    case 'failed':
      return <XCircle size={14} className="text-red-400" />;
    case 'interrupted':
      return <XCircle size={14} className="text-yellow-400" />;
    default:
      return <div className="w-3.5 h-3.5 rounded-full bg-zinc-600" />;
  }
}

export function ToolStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Loader2 size={12} className="animate-spin text-blue-400" />;
    case 'failed':
      return <XCircle size={12} className="text-red-400" />;
    default:
      return <Wrench size={12} className="text-zinc-600" />;
  }
}

export function ModelBadge({ model }: { model: string | null }) {
  if (!model) return null;
  return (
    <span className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-700 text-zinc-400 font-medium uppercase shrink-0">
      {model}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatDuration(ms: number | null): string {
  if (ms == null) return '-';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

export function formatTime(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Turn grouping
// ---------------------------------------------------------------------------

export interface Turn {
  orchestrator: AgentNode;
  children: AgentNode[];
}

export function groupByTurn(agents: AgentNode[]): Turn[] {
  const orchestrators = agents
    .filter((a) => a.type === 'orchestrator')
    .sort((a, b) => a.startedAt - b.startedAt);

  return orchestrators.map((orc) => ({
    orchestrator: orc,
    children: agents.filter((a) => a.parentAgentId === orc.id),
  }));
}
