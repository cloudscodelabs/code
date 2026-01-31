import { usePlanPanelStore } from '../../stores/plan-panel-store.js';
import { PlanDetailHeader } from './PlanDetailHeader.js';
import { PlanStepsPanel } from './PlanStepsPanel.js';
import { PlanAgentActivity } from './PlanAgentActivity.js';

export function PlanDetailView() {
  const isExecuting = usePlanPanelStore((s) => s.isExecuting);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <PlanDetailHeader />
      {isExecuting && <PlanAgentActivity />}
      <PlanStepsPanel />
    </div>
  );
}
