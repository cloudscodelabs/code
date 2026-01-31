import { useState } from 'react';
import { useAgentStore } from '../../stores/agent-store.js';
import { ToolCallDetail } from './ToolCallDetail.js';
import { StatusIcon, ToolStatusIcon, ModelBadge, agentLabels, formatDuration } from './agent-utils.js';
import { ChevronLeft, ChevronRight, ChevronDown, Clock, DollarSign, Cpu, FileText, Layers, Wrench, Loader2, Square } from 'lucide-react';
import type { AgentNode, AgentToolActivity, AgentContextSection } from '@cloudscode/shared';
import { wsClient } from '../../lib/ws-client.js';

// ---------------------------------------------------------------------------
// Context Sections
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
// Agent Detail View
// ---------------------------------------------------------------------------

export function AgentDetailView({
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
            Back
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
