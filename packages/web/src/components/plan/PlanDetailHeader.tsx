import { Play, RefreshCw, RotateCcw, Trash2, Maximize2 } from 'lucide-react';
import type { PlanStatus } from '@cloudscode/shared';
import { usePlanPanelStore } from '../../stores/plan-panel-store.js';
import { usePlanListStore } from '../../stores/plan-list-store.js';
import { wsClient } from '../../lib/ws-client.js';
import { api } from '../../lib/api-client.js';

const statusColors: Record<PlanStatus, string> = {
  drafting: 'bg-amber-900/50 text-amber-300',
  ready: 'bg-blue-900/50 text-blue-300',
  executing: 'bg-purple-900/50 text-purple-300',
  completed: 'bg-green-900/50 text-green-300',
  failed: 'bg-red-900/50 text-red-300',
  cancelled: 'bg-zinc-800 text-zinc-400',
};

export function PlanDetailHeader() {
  const currentPlan = usePlanPanelStore((s) => s.currentPlan);
  const isExecuting = usePlanPanelStore((s) => s.isExecuting);
  const setView = usePlanPanelStore((s) => s.setView);

  if (!currentPlan) return null;

  const canExecute =
    (currentPlan.status === 'ready' ||
      currentPlan.status === 'failed') &&
    !isExecuting;

  const isWorkflow = currentPlan.workflowMetadata != null;
  const canResume =
    isWorkflow &&
    currentPlan.status === 'failed' &&
    !isExecuting &&
    !!currentPlan.workflowMetadata?.checkpointStepId;
  const canRollback =
    isWorkflow &&
    !isExecuting &&
    !!currentPlan.workflowMetadata?.rollbackInfo?.gitCommitBefore;

  const handleExecute = () => {
    wsClient.send({
      type: 'plan:execute',
      payload: { planId: currentPlan.id },
    });
  };

  const handleResume = () => {
    wsClient.send({
      type: 'workflow:resume',
      payload: { planId: currentPlan.id },
    });
  };

  const handleRollback = () => {
    wsClient.send({
      type: 'workflow:rollback',
      payload: { planId: currentPlan.id },
    });
  };

  const handleDelete = async () => {
    try {
      await api.deletePlan(currentPlan.id);
      usePlanListStore.getState().removePlan(currentPlan.id);
      usePlanPanelStore.getState().clearPlan();
      setView('list');
    } catch (err) {
      console.error('Failed to delete plan:', err);
    }
  };

  const handleOpenInChat = () => {
    setView('create');
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="text-sm font-medium text-zinc-200 truncate">{currentPlan.title}</h3>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${statusColors[currentPlan.status as PlanStatus]}`}
        >
          {currentPlan.status}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {canResume && (
          <button
            onClick={handleResume}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors"
            title="Resume"
          >
            <RefreshCw size={12} />
            Resume
          </button>
        )}

        {canRollback && (
          <button
            onClick={handleRollback}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-red-700 hover:bg-red-600 text-white transition-colors"
            title="Rollback"
          >
            <RotateCcw size={12} />
            Rollback
          </button>
        )}

        {canExecute && (
          <button
            onClick={handleExecute}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition-colors"
            title="Execute"
          >
            <Play size={12} />
            Execute
          </button>
        )}

        <button
          onClick={handleOpenInChat}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          title="Details"
        >
          <Maximize2 size={12} />
          Details
        </button>

        <button
          onClick={handleDelete}
          className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
