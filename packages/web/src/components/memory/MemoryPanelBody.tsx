import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus } from 'lucide-react';
import type { MemoryEntry, MemoryCategory } from '@cloudscode/shared';
import { useProjectStore } from '../../stores/project-store.js';
import { useMemoryStore } from '../../stores/memory-store.js';
import { api } from '../../lib/api-client.js';
import { MemoryStatsBar } from './MemoryStatsBar.js';
import { MemoryCategorySidebar } from './MemoryCategorySidebar.js';
import { MemoryEntryList } from './MemoryEntryList.js';
import { PromotionSuggestions } from './PromotionSuggestions.js';

export function MemoryPanelBody() {
  const workspaceId = useProjectStore((s) => s.workspaceId);
  const activeProject = useProjectStore((s) => s.activeProject);

  const entries = useMemoryStore((s) => s.entries);
  const setEntries = useMemoryStore((s) => s.setEntries);
  const loading = useMemoryStore((s) => s.loading);
  const setLoading = useMemoryStore((s) => s.setLoading);
  const search = useMemoryStore((s) => s.search);
  const setSearch = useMemoryStore((s) => s.setSearch);
  const categoryFilter = useMemoryStore((s) => s.categoryFilter);
  const scopeFilter = useMemoryStore((s) => s.scopeFilter);
  const openEditor = useMemoryStore((s) => s.openEditor);
  const removeEntry = useMemoryStore((s) => s.removeEntry);

  const [allEntries, setAllEntries] = useState<MemoryEntry[]>([]);
  const [promotionCount, setPromotionCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Load entries
  const loadEntries = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const scopeProjectId = scopeFilter === 'project' && activeProject ? activeProject.id : undefined;

      if (debouncedSearch) {
        const { results } = await api.searchMemory(workspaceId, debouncedSearch, scopeProjectId);
        let filtered = results.map((r: any) => r.entry);
        if (scopeFilter === 'workspace') {
          filtered = filtered.filter((e: MemoryEntry) => e.scope === 'workspace');
        }
        if (categoryFilter) {
          filtered = filtered.filter((e: MemoryEntry) => e.category === categoryFilter);
        }
        setEntries(filtered);
      } else {
        const { entries: data } = await api.listMemory(workspaceId, categoryFilter || undefined, scopeProjectId);
        let filtered = data;
        if (scopeFilter === 'workspace') {
          filtered = filtered.filter((e: MemoryEntry) => e.scope === 'workspace');
        }
        setEntries(filtered);
      }
    } catch (err) {
      console.error('Failed to load memory entries:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, activeProject, debouncedSearch, categoryFilter, scopeFilter, setEntries, setLoading]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Load all entries for stats (unfiltered)
  const loadAllEntries = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const { entries: data } = await api.listMemory(workspaceId);
      setAllEntries(data);
    } catch (err) {
      console.error('Failed to load all entries:', err);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadAllEntries();
  }, [loadAllEntries]);

  // Load promotion count
  const loadPromotionCount = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const { suggestions } = await api.getPromotionSuggestions(workspaceId, activeProject?.id);
      setPromotionCount(suggestions.length);
    } catch {
      // ignore
    }
  }, [workspaceId, activeProject]);

  useEffect(() => {
    loadPromotionCount();
  }, [loadPromotionCount]);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMemory(id);
      removeEntry(id);
      // Refresh all entries for stats
      loadAllEntries();
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  const handlePromote = async (entryId: string) => {
    if (!activeProject) return;
    try {
      await api.promoteMemory(entryId, activeProject.id);
      loadEntries();
      loadAllEntries();
      loadPromotionCount();
    } catch (err) {
      console.error('Failed to promote:', err);
    }
  };

  // Check if project settings have data for an overlapping category
  const hasSettingsForCategory = (memCategory: MemoryCategory): boolean => {
    if (!activeProject) return false;
    const meta = activeProject.metadata;
    switch (memCategory) {
      case 'convention':
        return Boolean(
          (meta.codingStandards && meta.codingStandards.length > 0) ||
          (meta.namingConventions && meta.namingConventions.length > 0) ||
          (meta.errorHandling && meta.errorHandling.length > 0)
        );
      case 'architecture':
        return Boolean(
          (meta.designPatterns && meta.designPatterns.length > 0) ||
          meta.architecturePattern
        );
      case 'decision':
        return Boolean(meta.adrs && meta.adrs.length > 0);
      case 'fact':
        return Boolean(meta.domainConcepts && meta.domainConcepts.length > 0);
      case 'issue':
        return Boolean(meta.knownIssues && meta.knownIssues.length > 0);
      default:
        return false;
    }
  };

  // Expose reload so editor modal can refresh
  useEffect(() => {
    const handler = () => {
      loadEntries();
      loadAllEntries();
      loadPromotionCount();
    };
    window.addEventListener('memory-entries-changed', handler);
    return () => window.removeEventListener('memory-entries-changed', handler);
  }, [loadEntries, loadAllEntries, loadPromotionCount]);

  if (!workspaceId) {
    return <div className="p-6 text-sm text-zinc-500">No project loaded.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <MemoryStatsBar entries={allEntries} />

      {/* Search + Add */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search knowledge..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>
        <button
          onClick={() => openEditor()}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex-shrink-0"
        >
          <Plus size={14} />
          Add Entry
        </button>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <MemoryCategorySidebar entries={allEntries} promotionCount={promotionCount} />

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <MemoryEntryList
                entries={entries}
                hasActiveProject={!!activeProject}
                hasSettingsForCategory={hasSettingsForCategory}
                onPromote={handlePromote}
                onDelete={handleDelete}
              />
              {/* Promotion suggestions at bottom when viewing all */}
              {!categoryFilter && !debouncedSearch && activeProject && entries.length > 0 && (
                <div className="px-4 pb-4">
                  <PromotionSuggestions />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
