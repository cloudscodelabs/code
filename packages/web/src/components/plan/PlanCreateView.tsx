import { usePlanPanelStore } from '../../stores/plan-panel-store.js';
import { PlanPanelHeader } from './PlanPanelHeader.js';
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
      <div className="flex flex-1 min-h-0">
        {/* Steps panel — animates in from width 0 */}
        <div
          className={`transition-[width] duration-300 ease-out overflow-hidden shrink-0 ${
            currentPlan ? 'w-80' : 'w-0'
          }`}
        >
          <div className="w-80 h-full border-r border-zinc-700">
            <PlanStepsPanel />
          </div>
        </div>
        <PlanChatArea />
      </div>
    </div>
  );
}
