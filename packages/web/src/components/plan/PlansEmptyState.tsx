import { Map } from 'lucide-react';

export function PlansEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <Map size={40} className="text-zinc-600 mb-4" />
      <p className="text-sm text-zinc-400">Select a plan</p>
      <p className="text-xs text-zinc-500 mt-1">
        Choose a plan from the sidebar to view its details and steps.
      </p>
    </div>
  );
}
