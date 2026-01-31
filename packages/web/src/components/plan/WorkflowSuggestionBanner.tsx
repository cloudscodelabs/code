import { Zap, X } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { wsClient } from '../../lib/ws-client.js';

export function WorkflowSuggestionBanner() {
  const suggestion = useWorkflowStore((s) => s.suggestion);
  const dismissSuggestion = useWorkflowStore((s) => s.dismissSuggestion);
  const activeProject = useProjectStore((s) => s.activeProject);

  if (!suggestion || !activeProject) return null;

  const confidencePercent = Math.round(suggestion.confidence * 100);

  const handleUseTemplate = () => {
    wsClient.send({
      type: 'workflow:create',
      payload: {
        projectId: activeProject.id,
        templateId: suggestion.templateId,
        userMessage: suggestion.reasoning,
      },
    });
    dismissSuggestion();
  };

  return (
    <div className="mx-4 mb-2 rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Zap size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-amber-200">
              Suggested workflow: <span className="font-medium">{suggestion.templateName}</span>
              <span className="ml-2 text-amber-400/70">{confidencePercent}% match</span>
            </p>
            <p className="text-[10px] text-amber-300/60 mt-0.5">{suggestion.reasoning}</p>
          </div>
        </div>
        <button
          onClick={dismissSuggestion}
          className="p-0.5 text-amber-400/50 hover:text-amber-300 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={handleUseTemplate}
          className="px-3 py-1 rounded text-xs font-medium bg-amber-700 hover:bg-amber-600 text-white transition-colors"
        >
          Use Template
        </button>
        <button
          onClick={dismissSuggestion}
          className="px-3 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
