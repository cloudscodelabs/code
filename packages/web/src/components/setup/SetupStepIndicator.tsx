import { Check } from 'lucide-react';
import { useSetupPanelStore, SETUP_STEPS } from '../../stores/setup-panel-store.js';

export function SetupStepIndicator() {
  const currentStep = useSetupPanelStore((s) => s.currentStep);
  const completedSteps = useSetupPanelStore((s) => s.completedSteps);

  return (
    <div className="flex items-center justify-center gap-0 px-8 py-4">
      {SETUP_STEPS.map((label, index) => {
        const stepNum = index + 1;
        const isCompleted = completedSteps.has(stepNum);
        const isActive = stepNum === currentStep && !completedSteps.has(SETUP_STEPS.length);
        const isPending = !isCompleted && !isActive;

        return (
          <div key={label} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  isCompleted
                    ? 'bg-blue-600 text-white'
                    : isActive
                      ? 'bg-zinc-800 text-blue-400 ring-2 ring-blue-500'
                      : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {isCompleted ? <Check size={14} /> : stepNum}
              </div>
              <span
                className={`mt-1.5 text-[11px] whitespace-nowrap ${
                  isCompleted
                    ? 'text-blue-400 font-medium'
                    : isActive
                      ? 'text-zinc-200 font-medium'
                      : 'text-zinc-500'
                }`}
              >
                {label}
              </span>
            </div>

            {/* Connector line (not after last step) */}
            {index < SETUP_STEPS.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-2 mt-[-18px] transition-colors ${
                  completedSteps.has(stepNum) ? 'bg-blue-600' : 'bg-zinc-700'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
