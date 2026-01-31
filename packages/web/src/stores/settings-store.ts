import { create } from 'zustand';
import type { ContextBudget } from '@cloudscode/shared';

type AuthType = 'oauth' | 'api_key' | 'none';

interface SettingsState {
  contextBudget: ContextBudget | null;

  // Project settings panel
  projectSettingsOpen: boolean;

  // Agent detail panel
  agentDetailPanelOpen: boolean;

  // Memory panel
  memoryPanelOpen: boolean;

  // Token stats panel
  tokenStatsPanelOpen: boolean;

  // Auth state
  authenticated: boolean | null; // null = loading
  authType: AuthType;
  subscriptionType: string | null;
  settingsModalOpen: boolean;

  setContextBudget: (budget: ContextBudget) => void;

  openProjectSettings: () => void;
  closeProjectSettings: () => void;

  openAgentDetailPanel: () => void;
  closeAgentDetailPanel: () => void;

  openMemoryPanel: () => void;
  closeMemoryPanel: () => void;

  openTokenStatsPanel: () => void;
  closeTokenStatsPanel: () => void;

  setAuthStatus: (status: {
    authenticated: boolean;
    authType: AuthType;
    subscriptionType: string | null;
  }) => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  contextBudget: null,

  projectSettingsOpen: false,
  agentDetailPanelOpen: false,
  memoryPanelOpen: false,
  tokenStatsPanelOpen: false,

  authenticated: null,
  authType: 'none',
  subscriptionType: null,
  settingsModalOpen: false,

  setContextBudget: (budget) => set({ contextBudget: budget }),

  openProjectSettings: () => set({ projectSettingsOpen: true }),
  closeProjectSettings: () => set({ projectSettingsOpen: false }),

  openAgentDetailPanel: () => set({ agentDetailPanelOpen: true }),
  closeAgentDetailPanel: () => set({ agentDetailPanelOpen: false }),

  openMemoryPanel: () => set({ memoryPanelOpen: true }),
  closeMemoryPanel: () => set({ memoryPanelOpen: false }),

  openTokenStatsPanel: () => set({ tokenStatsPanelOpen: true }),
  closeTokenStatsPanel: () => set({ tokenStatsPanelOpen: false }),

  setAuthStatus: ({ authenticated, authType, subscriptionType }) =>
    set({ authenticated, authType, subscriptionType }),
  openSettingsModal: () => set({ settingsModalOpen: true }),
  closeSettingsModal: () => set({ settingsModalOpen: false }),
}));
