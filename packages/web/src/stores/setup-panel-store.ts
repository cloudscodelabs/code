import { create } from 'zustand';
import type { Project, ProjectMetadata } from '@cloudscode/shared';
import type { ChatMessage } from './chat-store.js';

export interface SetupStep {
  label: string;
  completed: boolean;
}

const SETUP_STEPS: readonly string[] = [
  'Basics',
  'Directory',
  'Tech Stack',
  'Conventions',
  'AI Preferences',
  'Complete',
];

interface SetupPanelState {
  // Panel lifecycle
  isOpen: boolean;
  setupProjectId: string | null;

  // Step tracking (1-based, steps 1-6)
  currentStep: number;
  completedSteps: Set<number>;

  // Embedded chat state
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  error: string | null;

  // Actions — panel lifecycle
  openPanel: () => void;
  closePanel: () => void;
  reset: () => void;
  setSetupProjectId: (id: string) => void;

  // Actions — step tracking
  updateStepsFromProject: (project: Project, metadata?: ProjectMetadata) => void;

  // Actions — chat
  addMessage: (message: ChatMessage) => void;
  loadMessages: (messages: ChatMessage[]) => void;
  appendToken: (token: string) => void;
  startStreaming: () => void;
  finishStreaming: () => void;
  setError: (error: string | null) => void;
}

function computeSteps(project: Project, metadata?: ProjectMetadata): { current: number; completed: Set<number> } {
  const completed = new Set<number>();

  const step1 = !!(project.title || project.description || project.purpose);
  const step2 = !!project.directoryPath;
  const step3 = !!(project.primaryLanguage || (metadata?.techStack && metadata.techStack.length > 0));
  const step4 = !!((metadata?.namingConventions && metadata.namingConventions.length > 0) || (metadata?.codingStandards && metadata.codingStandards.length > 0) || metadata?.git);
  const step5 = !!metadata?.ai;
  const step6 = !!project.setupCompleted;

  if (step1) completed.add(1);
  if (step2) completed.add(2);
  if (step3) completed.add(3);
  if (step4) completed.add(4);
  if (step5) completed.add(5);
  if (step6) completed.add(6);

  // Current step is the first incomplete step, or 6 if all done
  const current = !step1 ? 1 : !step2 ? 2 : !step3 ? 3 : !step4 ? 4 : !step5 ? 5 : 6;

  return { current, completed };
}

let setupMessageCounter = 0;

export const useSetupPanelStore = create<SetupPanelState>((set) => ({
  isOpen: false,
  setupProjectId: null,
  currentStep: 1,
  completedSteps: new Set<number>(),
  messages: [],
  streamingContent: '',
  isStreaming: false,
  error: null,

  openPanel: () => set({ isOpen: true }),

  closePanel: () => set({ isOpen: false }),

  reset: () =>
    set({
      isOpen: false,
      setupProjectId: null,
      currentStep: 1,
      completedSteps: new Set<number>(),
      messages: [],
      streamingContent: '',
      isStreaming: false,
      error: null,
    }),

  setSetupProjectId: (id) => set({ setupProjectId: id }),

  updateStepsFromProject: (project, metadata) =>
    set(() => {
      const { current, completed } = computeSteps(project, metadata);
      return { currentStep: current, completedSteps: completed };
    }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  loadMessages: (messages) =>
    set({ messages, streamingContent: '', isStreaming: false, error: null }),

  appendToken: (token) =>
    set((state) => ({
      streamingContent: state.streamingContent + token,
    })),

  startStreaming: () =>
    set({ isStreaming: true, streamingContent: '', error: null }),

  finishStreaming: () =>
    set((state) => {
      if (state.streamingContent) {
        return {
          isStreaming: false,
          streamingContent: '',
          messages: [
            ...state.messages,
            {
              id: `setup-stream-${++setupMessageCounter}`,
              role: 'assistant' as const,
              content: state.streamingContent,
              agentId: 'orchestrator',
              timestamp: Date.now(),
            },
          ],
        };
      }
      return { isStreaming: false, streamingContent: '' };
    }),

  setError: (error) => set({ error, isStreaming: false }),
}));

export { SETUP_STEPS };
