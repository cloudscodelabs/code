import { usePlanPanelStore } from '../../stores/plan-panel-store.js';
import { PlanPanelHeader } from './PlanPanelHeader.js';
import { PlanAgentActivity } from './PlanAgentActivity.js';
import { PlanStepsPanel } from './PlanStepsPanel.js';
import { PlanChatArea } from './PlanChatArea.js';

export function PlanCreateView() {
  const currentPlan = usePlanPanelStore((s) => s.currentPlan);

  const handleClose = () => {
    usePlanPanelStore.getState().setView('list');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PlanPanelHeader onClose={handleClose} />
      <PlanAgentActivity />
      {currentPlan && <PlanStepsPanel />}
      <PlanChatArea />
    </div>
  );
}
