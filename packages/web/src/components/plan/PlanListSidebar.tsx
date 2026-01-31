import { useEffect } from 'react';
import { Plus, Map } from 'lucide-react';
import type { PlanListItem, PlanStatus } from '@cloudscode/shared';
import { usePlanListStore } from '../../stores/plan-list-store.js';
import { usePlanPanelStore } from '../../stores/plan-panel-store.js';
import { useProjectStore } from '../../stores/project-store.js';

const statusColors: Record<PlanStatus, string> = {
  drafting: 'bg-amber-900/50 text-amber-300',
  ready: 'bg-blue-900/50 text-blue-300',
  executing: 'bg-purple-900/50 text-purple-300',
  completed: 'bg-green-900/50 text-green-300',
  failed: 'bg-red-900/50 text-red-300',
  cancelled: 'bg-zinc-800 text-zinc-400',
};

function relativeTime(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function PlanListSidebar() {
  const plans = usePlanListStore((s) => s.plans);
  const loading = usePlanListStore((s) => s.loading);
  const loadPlans = usePlanListStore((s) => s.loadPlans);
  const selectedPlanId = usePlanListStore((s) => s.selectedPlanId);
  const selectAndLoadPlan = usePlanListStore((s) => s.selectAndLoadPlan);
  const activeProject = useProjectStore((s) => s.activeProject);
  const openCreateView = usePlanPanelStore((s) => s.openCreateView);

  useEffect(() => {
    if (activeProject?.id) {
      loadPlans(activeProject.id);
    }
  }, [activeProject?.id, loadPlans]);

  const handleCardClick = async (planId: string) => {
    await selectAndLoadPlan(planId);
  };

  return (
    <div className="w-72 border-r border-zinc-700 flex flex-col shrink-0">
      <div className="p-3 border-b border-zinc-700">
        <button
          onClick={openCreateView}
          disabled={!activeProject}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
          title={activeProject ? 'Create a new plan' : 'Select a project first'}
        >
          <Plus size={12} />
          New Plan
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!activeProject && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Map size={28} className="text-zinc-600 mb-3" />
            <p className="text-sm text-zinc-400">No active project</p>
            <p className="text-xs text-zinc-500 mt-1">Select or create a project to view and create plans.</p>
          </div>
        )}

        {activeProject && loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          </div>
        )}

        {activeProject && !loading && plans.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Map size={28} className="text-zinc-600 mb-3" />
            <p className="text-sm text-zinc-400">No plans yet.</p>
            <p className="text-xs text-zinc-500 mt-1">Create a new plan to get started.</p>
          </div>
        )}

        {activeProject && !loading &&
          plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={plan.id === selectedPlanId}
              onClick={() => handleCardClick(plan.id)}
            />
          ))}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  isSelected,
  onClick,
}: {
  plan: PlanListItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg p-3 transition-colors ${
        isSelected
          ? 'bg-zinc-800 border-l-2 border-blue-500'
          : 'bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800/80'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm text-zinc-200 font-medium truncate flex-1 min-w-0">
          {plan.title}
        </h4>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${statusColors[plan.status]}`}
        >
          {plan.status}
        </span>
      </div>
      {plan.summary && (
        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{plan.summary}</p>
      )}
      <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
        <span>
          {plan.completedStepCount}/{plan.stepCount} steps
        </span>
        <span>{relativeTime(plan.updatedAt)}</span>
      </div>
    </button>
  );
}
