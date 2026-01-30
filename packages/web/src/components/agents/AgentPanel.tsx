import { useState } from 'react';
import { useAgentStore } from '../../stores/agent-store.js';
import { ToolCallDetail } from './ToolCallDetail.js';
import { Loader2, CheckCircle2, XCircle, Wrench, ChevronRight, ChevronLeft, ChevronDown, Clock, DollarSign, Cpu, FileText, Layers, Square } from 'lucide-react';
import type { AgentNode, AgentToolActivity, AgentContextSection } from '@cloudscode/shared';
import { wsClient } from '../../lib/ws-client.js';

const agentLabels: Record<string, string> = {
  'orchestrator': 'Orchestrator',
  'code-analyst': 'Code Analyst',
  'implementer': 'Implementer',
  'test-runner': 'Test Runner',
  'researcher': 'Researcher',
};

function ModelBadge({ model }: { model: string | null }) {
  if (!model) return null;
  return (
    <span className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-700 text-zinc-400 font-medium uppercase shrink-0">
      {model}
    </span>
  );
}

function AgentNodeRow({
  agent,
  currentTool,
  isSelected,
  onClick,
}: {
  agent: AgentNode;
  currentTool?: AgentToolActivity;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isOrc = agent.type === 'orchestrator';

  return (
    <div>
      <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 w-full text-left rounded transition-colors ${isOrc ? '' : 'ml-4'} ${
          isSelected ? 'bg-zinc-800 ring-1 ring-zinc-600' : 'hover:bg-zinc-800/50'
        }`}
        style={!isOrc ? { width: 'calc(100% - 1rem)' } : undefined}
      >
        <StatusIcon status={agent.status} />
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-300">{agentLabels[agent.type] ?? agent.type}</span>
            <ModelBadge model={agent.model} />
          </div>
          {!isOrc && agent.taskDescription && (
            <span className="text-xs text-zinc-500 truncate">{agent.taskDescription}</span>
          )}
        </div>
        <span className="text-xs text-zinc-600 shrink-0">
          {agent.costUsd > 0 ? `$${agent.costUsd.toFixed(4)}` : ''}
        </span>
        {agent.status === 'running' && agent.type !== 'orchestrator' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              wsClient.send({ type: 'agent:interrupt', payload: { agentId: agent.id } });
            }}
            className="p-0.5 rounded hover:bg-red-900/50 transition-colors shrink-0"
            title="Stop this agent"
          >
            <Square size={12} className="text-red-400" />
          </button>
        )}
      </button>
      {agent.status === 'running' && currentTool && currentTool.status === 'running' && (
        <div className={`flex items-center gap-2 px-3 pb-1 text-xs text-blue-400 ${isOrc ? 'ml-5' : 'ml-9'}`}>
          <Loader2 size={10} className="animate-spin" />
          <span className="truncate">{currentTool.toolName}</span>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
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

function ToolStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Loader2 size={12} className="animate-spin text-blue-400" />;
    case 'failed':
      return <XCircle size={12} className="text-red-400" />;
    default:
      return <Wrench size={12} className="text-zinc-600" />;
  }
}

interface Turn {
  orchestrator: AgentNode;
  children: AgentNode[];
}

function groupByTurn(agents: AgentNode[]): Turn[] {
  const orchestrators = agents
    .filter((a) => a.type === 'orchestrator')
    .sort((a, b) => a.startedAt - b.startedAt);

  return orchestrators.map((orc) => ({
    orchestrator: orc,
    children: agents.filter((a) => a.parentAgentId === orc.id),
  }));
}

function formatTime(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '-';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

// ---------------------------------------------------------------------------
// Context Sections — shows what context was given to an agent
// ---------------------------------------------------------------------------

function ContextSections({ sections }: { sections: AgentContextSection[] }) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  return (
    <div className="px-3 py-3 border-b border-zinc-800">
      <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2 flex items-center gap-1">
        <Layers size={11} />
        Context
      </h4>

      {/* Chips row */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {sections.map((section) => (
          <span
            key={section.name}
            className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
              section.included
                ? 'bg-green-900/40 text-green-400 border border-green-800/50'
                : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'
            }`}
          >
            {section.name}
          </span>
        ))}
      </div>

      {/* Expandable sections for included items */}
      <div className="space-y-0.5">
        {sections
          .filter((s) => s.included && s.content)
          .map((section) => {
            const isExpanded = expandedSection === section.name;
            return (
              <div key={section.name}>
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.name)}
                  className="flex items-center gap-1.5 px-2 py-1 w-full text-left rounded hover:bg-zinc-800/50 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown size={12} className="text-zinc-500 shrink-0" />
                  ) : (
                    <ChevronRight size={12} className="text-zinc-500 shrink-0" />
                  )}
                  <span className="text-xs text-zinc-400">{section.name}</span>
                </button>
                {isExpanded && (
                  <pre className="text-xs text-zinc-400 bg-zinc-950 rounded p-3 mx-2 mb-1 overflow-auto max-h-[40vh] whitespace-pre-wrap break-words leading-relaxed">
                    {section.content}
                  </pre>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent Detail View — shown when an agent is selected
// ---------------------------------------------------------------------------

function AgentDetail({
  agent,
  agentTools,
  onBack,
}: {
  agent: AgentNode;
  agentTools: AgentToolActivity[];
  onBack: () => void;
}) {
  const selectToolCall = useAgentStore((s) => s.selectToolCall);
  const selectedToolCallId = useAgentStore((s) => s.selectedToolCallId);
  const agentContexts = useAgentStore((s) => s.agentContexts);
  const contextSections = agentContexts.get(agent.id);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        {/* Back button + header */}
        <div className="px-3 py-2 border-b border-zinc-800">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-2"
          >
            <ChevronLeft size={14} />
            Back to tree
          </button>
          <div className="flex items-center gap-2">
            <StatusIcon status={agent.status} />
            <h3 className="text-sm font-medium text-zinc-200">
              {agentLabels[agent.type] ?? agent.type}
            </h3>
            <ModelBadge model={agent.model} />
            {agent.status === 'running' && agent.type !== 'orchestrator' && (
              <button
                onClick={() => {
                  wsClient.send({ type: 'agent:interrupt', payload: { agentId: agent.id } });
                }}
                className="ml-auto p-1 rounded hover:bg-red-900/50 transition-colors"
                title="Stop this agent"
              >
                <Square size={12} className="text-red-400" />
              </button>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="px-3 py-3 border-b border-zinc-800 space-y-2">
          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            {agent.durationMs != null && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {formatDuration(agent.durationMs)}
              </span>
            )}
            {agent.costUsd > 0 && (
              <span className="flex items-center gap-1">
                <DollarSign size={11} />
                ${agent.costUsd.toFixed(4)}
              </span>
            )}
            {agent.tokens > 0 && (
              <span className="flex items-center gap-1">
                <Cpu size={11} />
                {agent.tokens.toLocaleString()} tokens
              </span>
            )}
          </div>

          {/* Task description */}
          {agent.taskDescription && (
            <div>
              <h4 className="text-xs font-medium text-zinc-500 uppercase mb-1">Task</h4>
              <p className="text-xs text-zinc-400 whitespace-pre-wrap">{agent.taskDescription}</p>
            </div>
          )}
        </div>

        {/* Context sections */}
        {contextSections && contextSections.length > 0 && (
          <ContextSections sections={contextSections} />
        )}

        {/* Response text */}
        <div className="px-3 py-3 border-b border-zinc-800">
          <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2 flex items-center gap-1">
            <FileText size={11} />
            Response
          </h4>
          {agent.status === 'running' ? (
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Loader2 size={12} className="animate-spin" />
              Working...
            </div>
          ) : (agent.responseText || agent.resultSummary) ? (
            <pre className="text-xs text-zinc-300 bg-zinc-950 rounded p-3 overflow-auto max-h-[50vh] whitespace-pre-wrap break-words leading-relaxed">
              {agent.responseText ?? agent.resultSummary}
            </pre>
          ) : (
            <p className="text-xs text-zinc-600 italic">No response recorded</p>
          )}
        </div>

        {/* Tool calls for this agent */}
        {agentTools.length > 0 && (
          <div className="px-3 py-3">
            <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2 flex items-center gap-1">
              <Wrench size={11} />
              Tool Calls ({agentTools.length})
            </h4>
            <div className="space-y-0.5">
              {agentTools.map((act) => (
                <button
                  key={act.id}
                  onClick={() => selectToolCall(selectedToolCallId === act.id ? null : act.id)}
                  className={`flex items-center gap-2 px-2 py-1.5 w-full text-left rounded transition-colors ${
                    selectedToolCallId === act.id
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'hover:bg-zinc-800/50 text-zinc-400'
                  }`}
                >
                  <ToolStatusIcon status={act.status} />
                  <span className="text-xs truncate flex-1">{act.toolName}</span>
                  {act.durationMs != null && (
                    <span className="text-xs text-zinc-600 shrink-0">
                      {formatDuration(act.durationMs)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <ToolCallDetail />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Turn Section
// ---------------------------------------------------------------------------

function TurnSection({
  turn,
  index,
  isLatest,
  runningToolByAgent,
  selectedAgentId,
  onSelectAgent,
}: {
  turn: Turn;
  index: number;
  isLatest: boolean;
  runningToolByAgent: Map<string, AgentToolActivity>;
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(isLatest);

  return (
    <div className={isLatest ? '' : 'opacity-70'}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 w-full text-left hover:bg-zinc-800/50 rounded transition-colors"
      >
        <ChevronRight
          size={12}
          className={`text-zinc-500 transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        <span className="text-xs text-zinc-500">
          Turn {index + 1}
        </span>
        <span className="text-xs text-zinc-600">
          {formatTime(turn.orchestrator.startedAt)}
        </span>
        <StatusIcon status={turn.orchestrator.status} />
      </button>

      {expanded && (
        <div>
          <AgentNodeRow
            agent={turn.orchestrator}
            currentTool={runningToolByAgent.get(turn.orchestrator.id)}
            isSelected={selectedAgentId === turn.orchestrator.id}
            onClick={() => onSelectAgent(turn.orchestrator.id)}
          />
          {turn.children.map((sub) => (
            <AgentNodeRow
              key={sub.id}
              agent={sub}
              currentTool={runningToolByAgent.get(sub.id)}
              isSelected={selectedAgentId === sub.id}
              onClick={() => onSelectAgent(sub.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export function AgentPanel() {
  const agents = useAgentStore((s) => s.agents);
  const toolActivity = useAgentStore((s) => s.toolActivity);
  const selectedToolCallId = useAgentStore((s) => s.selectedToolCallId);
  const selectToolCall = useAgentStore((s) => s.selectToolCall);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);

  const agentList = Array.from(agents.values());
  const turns = groupByTurn(agentList);

  // Find the most recent running tool for each agent
  const runningToolByAgent = new Map<string, AgentToolActivity>();
  for (const act of toolActivity) {
    if (act.status === 'running') {
      runningToolByAgent.set(act.agentId, act);
    }
  }

  if (agentList.length === 0) {
    return (
      <div className="p-4 text-sm text-zinc-500">
        No agents active. Send a message to start.
      </div>
    );
  }

  // If an agent is selected, show its detail view
  const selectedAgent = selectedAgentId ? agents.get(selectedAgentId) : null;
  if (selectedAgent) {
    const agentTools = toolActivity.filter((t) => t.agentId === selectedAgent.id);
    return (
      <AgentDetail
        agent={selectedAgent}
        agentTools={agentTools}
        onBack={() => selectAgent(null)}
      />
    );
  }

  // Default: tree view
  return (
    <div className="flex flex-col h-full">
      <div className="p-2 flex-1 overflow-auto">
        <div className="mb-3">
          <h3 className="px-3 py-1 text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Agent Tree
          </h3>
          {turns.map((turn, i) => (
            <TurnSection
              key={turn.orchestrator.id}
              turn={turn}
              index={i}
              isLatest={i === turns.length - 1}
              runningToolByAgent={runningToolByAgent}
              selectedAgentId={selectedAgentId}
              onSelectAgent={(id) => selectAgent(id)}
            />
          ))}
        </div>

        {toolActivity.length > 0 && (
          <div>
            <h3 className="px-3 py-1 text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Recent Tools
            </h3>
            <div className="space-y-0.5">
              {toolActivity.slice(-15).reverse().map((act) => (
                <button
                  key={act.id}
                  onClick={() => selectToolCall(selectedToolCallId === act.id ? null : act.id)}
                  className={`flex items-center gap-2 px-3 py-1 w-full text-left rounded transition-colors ${
                    selectedToolCallId === act.id
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'hover:bg-zinc-800/50 text-zinc-400'
                  }`}
                >
                  <ToolStatusIcon status={act.status} />
                  <span className="text-xs truncate flex-1">{act.toolName}</span>
                  {act.durationMs != null && (
                    <span className="text-xs text-zinc-600 shrink-0">
                      {act.durationMs >= 1000
                        ? `${(act.durationMs / 1000).toFixed(1)}s`
                        : `${act.durationMs}ms`}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <ToolCallDetail />
    </div>
  );
}
