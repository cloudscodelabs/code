import { X, ArrowLeft, Plus } from 'lucide-react';
import { usePlanPanelStore } from '../../stores/plan-panel-store.js';
import { useProjectStore } from '../../stores/project-store.js';

interface PlansPanelHeaderProps {
  onClose: () => void;
}

export function PlansPanelHeader({ onClose }: PlansPanelHeaderProps) {
  const view = usePlanPanelStore((s) => s.view);
  const currentPlan = usePlanPanelStore((s) => s.currentPlan);
  const setView = usePlanPanelStore((s) => s.setView);
  const openCreateView = usePlanPanelStore((s) => s.openCreateView);
  const activeProject = useProjectStore((s) => s.activeProject);

  const isListView = view === 'list';

  const handleBack = () => {
    setView('list');
  };

  const title = isListView
    ? 'Plans'
    : view === 'create'
      ? 'New Plan'
      : currentPlan?.title ?? 'Plan Detail';

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 shrink-0">
      <div className="flex items-center gap-2">
        {!isListView && (
          <button
            onClick={handleBack}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Back to list"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <h2 className="text-sm font-medium text-zinc-100">{title}</h2>
      </div>

      <div className="flex items-center gap-2">
        {isListView && (
          <button
            onClick={openCreateView}
            disabled={!activeProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
            title={activeProject ? 'Create a new plan' : 'Select a project first'}
          >
            <Plus size={12} />
            New Plan
          </button>
        )}
        <button
          onClick={onClose}
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
