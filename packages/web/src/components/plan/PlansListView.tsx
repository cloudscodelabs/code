import { usePlanPanelStore } from '../../stores/plan-panel-store.js';
import { PlanListSidebar } from './PlanListSidebar.js';
import { PlanDetailView } from './PlanDetailView.js';
import { PlansEmptyState } from './PlansEmptyState.js';

export function PlansListView() {
  const currentPlan = usePlanPanelStore((s) => s.currentPlan);

  return (
    <div className="flex flex-1 min-h-0">
      <PlanListSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {currentPlan ? <PlanDetailView /> : <PlansEmptyState />}
      </div>
    </div>
  );
}
