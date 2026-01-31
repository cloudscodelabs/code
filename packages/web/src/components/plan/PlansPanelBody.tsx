import { usePlanPanelStore } from '../../stores/plan-panel-store.js';
import { PlansListView } from './PlansListView.js';
import { PlanCreateView } from './PlanCreateView.js';

export function PlansPanelBody() {
  const view = usePlanPanelStore((s) => s.view);

  if (view === 'list') {
    return <PlansListView />;
  }

  // Both 'detail' and 'create' use the create view (which composes existing components)
  return <PlanCreateView />;
}
