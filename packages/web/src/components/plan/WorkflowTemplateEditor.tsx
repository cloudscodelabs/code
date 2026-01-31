import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react';
import type { WorkflowTemplateStep } from '@cloudscode/shared';
import { useWorkflowStore } from '../../stores/workflow-store.js';
import { useProjectStore } from '../../stores/project-store.js';

interface WorkflowTemplateEditorProps {
  onBack: () => void;
  editTemplateId?: string;
}

const AGENT_TYPES = [
  { value: 'code-analyst', label: 'Code Analyst' },
  { value: 'implementer', label: 'Implementer' },
  { value: 'test-runner', label: 'Test Runner' },
  { value: 'researcher', label: 'Researcher' },
] as const;

const CATEGORIES = [
  { value: 'development', label: 'Development' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'testing', label: 'Testing' },
  { value: 'documentation', label: 'Documentation' },
] as const;

const COMPLEXITY = ['low', 'medium', 'high'] as const;

export function WorkflowTemplateEditor({ onBack, editTemplateId }: WorkflowTemplateEditorProps) {
  const templates = useWorkflowStore((s) => s.templates);
  const createTemplate = useWorkflowStore((s) => s.createTemplate);
  const updateTemplate = useWorkflowStore((s) => s.updateTemplate);
  const activeProject = useProjectStore((s) => s.activeProject);

  const existing = editTemplateId ? templates.find((t) => t.id === editTemplateId) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState(existing?.category ?? 'development');
  const [steps, setSteps] = useState<WorkflowTemplateStep[]>(
    existing?.steps ?? [createEmptyStep(0)]
  );
  const [saving, setSaving] = useState(false);

  function createEmptyStep(index: number): WorkflowTemplateStep {
    return {
      id: `step-${index + 1}`,
      title: '',
      description: '',
      agentType: 'implementer',
      estimatedComplexity: 'medium',
      dependencies: [],
    };
  }

  const addStep = () => {
    setSteps([...steps, createEmptyStep(steps.length)]);
  };

  const removeStep = (index: number) => {
    const removedId = steps[index].id;
    const updated = steps.filter((_, i) => i !== index);
    // Remove from dependencies
    for (const step of updated) {
      step.dependencies = step.dependencies.filter((d) => d !== removedId);
    }
    setSteps(updated);
  };

  const updateStep = (index: number, field: keyof WorkflowTemplateStep, value: any) => {
    const updated = [...steps];
    (updated[index] as any)[field] = value;
    setSteps(updated);
  };

  const handleSave = async () => {
    if (!name.trim() || !activeProject) return;
    setSaving(true);
    try {
      const input = { name, description, category, steps };
      if (existing) {
        await updateTemplate(existing.id, input);
      } else {
        await createTemplate(activeProject.id, input);
      }
      onBack();
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h3 className="text-sm font-medium text-zinc-200">
          {existing ? 'Edit Template' : 'New Template'}
        </h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Name</label>
          <input
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 block mb-1">Description</label>
          <textarea
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 resize-none focus:outline-none focus:border-zinc-500"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this workflow do?"
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 block mb-1">Category</label>
          <select
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof CATEGORIES[number]['value'])}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-zinc-400">Steps</label>
            <button
              onClick={addStep}
              className="flex items-center gap-1 px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
            >
              <Plus size={12} />
              Add Step
            </button>
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.id} className="border border-zinc-700 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-zinc-600 shrink-0" />
                  <span className="text-xs text-zinc-500 font-mono shrink-0">{index + 1}.</span>
                  <input
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                    value={step.title}
                    onChange={(e) => updateStep(index, 'title', e.target.value)}
                    placeholder="Step title"
                  />
                  {steps.length > 1 && (
                    <button
                      onClick={() => removeStep(index)}
                      className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <textarea
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 resize-none focus:outline-none focus:border-zinc-500"
                  rows={2}
                  value={step.description}
                  onChange={(e) => updateStep(index, 'description', e.target.value)}
                  placeholder="What should this step accomplish?"
                />

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-zinc-500 block mb-0.5">Agent</label>
                    <select
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
                      value={step.agentType}
                      onChange={(e) => updateStep(index, 'agentType', e.target.value)}
                    >
                      {AGENT_TYPES.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="text-[10px] text-zinc-500 block mb-0.5">Complexity</label>
                    <select
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
                      value={step.estimatedComplexity}
                      onChange={(e) => updateStep(index, 'estimatedComplexity', e.target.value)}
                    >
                      {COMPLEXITY.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {index > 0 && (
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-0.5">Dependencies</label>
                    <div className="flex flex-wrap gap-1">
                      {steps.slice(0, index).map((prev) => (
                        <label key={prev.id} className="flex items-center gap-1 text-[10px] text-zinc-400">
                          <input
                            type="checkbox"
                            checked={step.dependencies.includes(prev.id)}
                            onChange={(e) => {
                              const deps = e.target.checked
                                ? [...step.dependencies, prev.id]
                                : step.dependencies.filter((d) => d !== prev.id);
                              updateStep(index, 'dependencies', deps);
                            }}
                            className="rounded"
                          />
                          {prev.title || `Step ${steps.indexOf(prev) + 1}`}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-2 rounded text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="flex-1 py-2 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  );
}
