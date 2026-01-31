import { useState } from 'react';
import { useAgentStore } from '../../stores/agent-store.js';
import { AgentDetailView } from './AgentDetailView.js';
import { RunningAgentCard } from './RunningAgentCard.js';
import { CompletedTurnRow } from './CompletedTurnRow.js';
import { groupByTurn } from './agent-utils.js';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AgentToolActivity } from '@cloudscode/shared';

const VISIBLE_COMPLETED_TURNS = 5;

export function AgentPanel() {
  const agents = useAgentStore((s) => s.agents);
  const toolActivity = useAgentStore((s) => s.toolActivity);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const selectAgent = useAgentStore((s) => s.selectAgent);

  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const agentList = Array.from(agents.values());

  // --- Empty state ---
  if (agentList.length === 0) {
    return (
      <div className="p-4 text-sm text-zinc-500">
        No agents active. Send a message to start.
      </div>
    );
  }

  // --- Detail view ---
  const selectedAgent = selectedAgentId ? agents.get(selectedAgentId) : null;
  if (selectedAgent) {
    const agentTools = toolActivity.filter((t) => t.agentId === selectedAgent.id);
    return (
      <AgentDetailView
        agent={selectedAgent}
        agentTools={agentTools}
        onBack={() => selectAgent(null)}
      />
    );
  }

  // --- Build running + completed data ---
  const turns = groupByTurn(agentList);

  // Running agents: any agent with status === 'running'
  const runningAgents = agentList.filter((a) => a.status === 'running');

  // Running tool per agent
  const runningToolByAgent = new Map<string, AgentToolActivity>();
  for (const act of toolActivity) {
    if (act.status === 'running') {
      runningToolByAgent.set(act.agentId, act);
    }
  }

  // Recent completed tools per agent (last 3)
  const recentToolsByAgent = new Map<string, AgentToolActivity[]>();
  for (const agent of runningAgents) {
    const agentTools = toolActivity
      .filter((t) => t.agentId === agent.id && t.status !== 'running')
      .slice(-3);
    recentToolsByAgent.set(agent.id, agentTools);
  }

  // Completed turns: turns where orchestrator is not running
  const completedTurns = turns
    .filter((t) => t.orchestrator.status !== 'running')
    .reverse(); // newest first

  const visibleCompleted = showAllCompleted
    ? completedTurns
    : completedTurns.slice(0, VISIBLE_COMPLETED_TURNS);

  const hiddenCount = completedTurns.length - VISIBLE_COMPLETED_TURNS;

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 flex-1 overflow-auto space-y-4">
        {/* Running section */}
        {runningAgents.length > 0 && (
          <div>
            <h3 className="px-3 py-1 text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Running
            </h3>
            <div className="space-y-2 mt-1">
              {runningAgents.map((agent) => (
                <RunningAgentCard
                  key={agent.id}
                  agent={agent}
                  currentTool={runningToolByAgent.get(agent.id)}
                  recentTools={recentToolsByAgent.get(agent.id) ?? []}
                  onSelect={() => selectAgent(agent.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed section */}
        {completedTurns.length > 0 && (
          <div>
            <h3 className="px-3 py-1 text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Completed
            </h3>
            <div className="mt-1">
              {visibleCompleted.map((turn) => (
                <CompletedTurnRow
                  key={turn.orchestrator.id}
                  turn={turn}
                  toolActivity={toolActivity}
                  onSelectAgent={(id) => selectAgent(id)}
                />
              ))}

              {/* "Show earlier" toggle */}
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowAllCompleted((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 w-full text-left text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showAllCompleted ? (
                    <>
                      <ChevronDown size={12} />
                      Hide earlier turns
                    </>
                  ) : (
                    <>
                      <ChevronRight size={12} />
                      Show {hiddenCount} earlier turn{hiddenCount !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
