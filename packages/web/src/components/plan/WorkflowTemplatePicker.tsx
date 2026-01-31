import { useEffect, useState } from 'react';
import { Zap, Plus, Globe, FolderOpen } from 'lucide-react';
import type { WorkflowTemplate } from '@cloudscode/shared';
import { useWorkflowStore } from '../../stores/workflow-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { wsClient } from '../../lib/ws-client.js';

const categoryColors: Record<string, string> = {
  development: 'bg-blue-900/50 text-blue-300',
  maintenance: 'bg-amber-900/50 text-amber-300',
  testing: 'bg-green-900/50 text-green-300',
  documentation: 'bg-purple-900/50 text-purple-300',
};

interface WorkflowTemplatePickerProps {
  onCreateCustom: () => void;
}

export function WorkflowTemplatePicker({ onCreateCustom }: WorkflowTemplatePickerProps) {
  const templates = useWorkflowStore((s) => s.templates);
  const loading = useWorkflowStore((s) => s.loading);
  const loadTemplates = useWorkflowStore((s) => s.loadTemplates);
  const activeProject = useProjectStore((s) => s.activeProject);
  const [userMessage, setUserMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (activeProject?.id) {
      loadTemplates(activeProject.id);
    }
  }, [activeProject?.id, loadTemplates]);

  const globalTemplates = templates.filter((t) => t.isBuiltin);
  const projectTemplates = templates.filter((t) => !t.isBuiltin);

  const handleSelect = (template: WorkflowTemplate) => {
    setSelectedId(template.id);
  };

  const handleCreate = () => {
    if (!selectedId || !userMessage.trim() || !activeProject) return;
    wsClient.send({
      type: 'workflow:create',
      payload: {
        projectId: activeProject.id,
        templateId: selectedId,
        userMessage: userMessage.trim(),
      },
    });
    setUserMessage('');
    setSelectedId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          Workflow Templates
        </h3>
        <button
          onClick={onCreateCustom}
          className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
        >
          <Plus size={12} />
          Custom
        </button>
      </div>

      {globalTemplates.length > 0 && (
        <div>
          <h4 className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
            <Globe size={10} />
            Built-in
          </h4>
          <div className="space-y-2">
            {globalTemplates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                selected={selectedId === t.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      )}

      {projectTemplates.length > 0 && (
        <div>
          <h4 className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
            <FolderOpen size={10} />
            Project Templates
          </h4>
          <div className="space-y-2">
            {projectTemplates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                selected={selectedId === t.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      )}

      {selectedId && (
        <div className="border-t border-zinc-700 pt-3 space-y-2">
          <label className="text-xs text-zinc-400">Describe what you want to do:</label>
          <textarea
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500"
            rows={3}
            placeholder="e.g., Add a user authentication endpoint..."
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
          />
          <button
            onClick={handleCreate}
            disabled={!userMessage.trim()}
            className="w-full py-2 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Workflow Plan
          </button>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: WorkflowTemplate;
  selected: boolean;
  onSelect: (t: WorkflowTemplate) => void;
}) {
  return (
    <button
      onClick={() => onSelect(template)}
      className={`w-full text-left rounded-lg border p-3 transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-950/30'
          : 'border-zinc-700/50 bg-zinc-800/50 hover:border-zinc-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-200 font-medium">{template.name}</span>
            {template.isBuiltin && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-700 text-zinc-400">builtin</span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{template.description}</p>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${categoryColors[template.category] ?? 'bg-zinc-800 text-zinc-400'}`}>
          {template.category}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
        <span>{template.steps.length} steps</span>
      </div>
    </button>
  );
}
