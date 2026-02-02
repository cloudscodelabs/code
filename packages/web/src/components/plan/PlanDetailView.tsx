import { PlanDetailHeader } from './PlanDetailHeader.js';
import { PlanStepsPanel } from './PlanStepsPanel.js';

export function PlanDetailView() {
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      <PlanDetailHeader />
      <PlanStepsPanel />
    </div>
  );
}
