import { create } from 'zustand';
import type { WorkflowTemplate, WorkflowSuggestion, QualityGateResult } from '@cloudscode/shared';
import { api } from '../lib/api-client.js';

interface WorkflowState {
  templates: WorkflowTemplate[];
  loading: boolean;
  suggestion: WorkflowSuggestion | null;
  qualityGateResults: Record<string, QualityGateResult>;
  checkpointStepId: string | null;

  // Actions
  loadTemplates: (projectId: string) => Promise<void>;
  setSuggestion: (suggestion: WorkflowSuggestion | null) => void;
  dismissSuggestion: () => void;
  setQualityGateResult: (stepId: string, result: QualityGateResult) => void;
  setCheckpoint: (stepId: string) => void;
  resetExecution: () => void;

  // CRUD for custom templates
  createTemplate: (projectId: string, input: { name: string; description: string; category: string; steps: any[] }) => Promise<WorkflowTemplate>;
  updateTemplate: (id: string, input: Partial<{ name: string; description: string; category: string; steps: any[] }>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  templates: [],
  loading: false,
  suggestion: null,
  qualityGateResults: {},
  checkpointStepId: null,

  loadTemplates: async (projectId: string) => {
    set({ loading: true });
    try {
      const { templates } = await api.listWorkflowTemplates(projectId);
      set({ templates, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setSuggestion: (suggestion) => set({ suggestion }),
  dismissSuggestion: () => set({ suggestion: null }),

  setQualityGateResult: (stepId, result) =>
    set((state) => ({
      qualityGateResults: { ...state.qualityGateResults, [stepId]: result },
    })),

  setCheckpoint: (stepId) => set({ checkpointStepId: stepId }),

  resetExecution: () =>
    set({
      qualityGateResults: {},
      checkpointStepId: null,
    }),

  createTemplate: async (projectId, input) => {
    const template = await api.createWorkflowTemplate(projectId, input);
    set((state) => ({ templates: [...state.templates, template] }));
    return template;
  },

  updateTemplate: async (id, input) => {
    const updated = await api.updateWorkflowTemplate(id, input);
    set((state) => ({
      templates: state.templates.map((t) => (t.id === id ? updated : t)),
    }));
  },

  deleteTemplate: async (id) => {
    await api.deleteWorkflowTemplate(id);
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
    }));
  },
}));
