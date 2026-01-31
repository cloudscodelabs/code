import { create } from 'zustand';
import type { MemoryEntry, MemoryCategory, MemoryScope } from '@cloudscode/shared';

type ScopeFilter = 'all' | 'project' | 'workspace';

interface MemoryStoreState {
  entries: MemoryEntry[];
  loading: boolean;

  // Filters
  search: string;
  categoryFilter: MemoryCategory | '';
  scopeFilter: ScopeFilter;

  // Expanded entry
  expandedEntryId: string | null;

  // Flash animation key (incremented on each memory update)
  memoryFlashKey: number;

  // Editor modal
  editorOpen: boolean;
  editingEntry: MemoryEntry | null;

  // Actions
  setEntries: (entries: MemoryEntry[]) => void;
  setLoading: (loading: boolean) => void;
  setSearch: (search: string) => void;
  setCategoryFilter: (category: MemoryCategory | '') => void;
  setScopeFilter: (scope: ScopeFilter) => void;
  toggleExpandedEntry: (id: string) => void;
  openEditor: (entry?: MemoryEntry | null) => void;
  closeEditor: () => void;
  removeEntry: (id: string) => void;
  flashMemoryUpdate: () => void;
}

export const useMemoryStore = create<MemoryStoreState>((set) => ({
  entries: [],
  loading: false,

  search: '',
  categoryFilter: '',
  scopeFilter: 'all',

  expandedEntryId: null,

  memoryFlashKey: 0,

  editorOpen: false,
  editingEntry: null,

  setEntries: (entries) => set({ entries }),
  setLoading: (loading) => set({ loading }),
  setSearch: (search) => set({ search }),
  setCategoryFilter: (category) => set({ categoryFilter: category }),
  setScopeFilter: (scope) => set({ scopeFilter: scope }),
  toggleExpandedEntry: (id) =>
    set((state) => ({
      expandedEntryId: state.expandedEntryId === id ? null : id,
    })),
  openEditor: (entry = null) => set({ editorOpen: true, editingEntry: entry }),
  closeEditor: () => set({ editorOpen: false, editingEntry: null }),
  removeEntry: (id) =>
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
    })),
  flashMemoryUpdate: () =>
    set((state) => ({ memoryFlashKey: state.memoryFlashKey + 1 })),
}));
