import { useState, useEffect, useCallback } from 'react';
import { ArrowUpCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import type { MemoryEntry, MemoryCategory } from '@cloudscode/shared';
import { useProjectStore } from '../../stores/project-store.js';
import { api } from '../../lib/api-client.js';

const categoryColors: Record<MemoryCategory, string> = {
  architecture: 'text-purple-400 bg-purple-400/10',
  convention: 'text-blue-400 bg-blue-400/10',
  decision: 'text-green-400 bg-green-400/10',
  fact: 'text-yellow-400 bg-yellow-400/10',
  issue: 'text-red-400 bg-red-400/10',
};

interface PromotionSuggestion {
  entry: MemoryEntry;
  promotion: {
    category: string;
    label: string;
    hasConflict: boolean;
  } | null;
}

export function PromotionSuggestions() {
  const workspaceId = useProjectStore((s) => s.workspaceId);
  const activeProject = useProjectStore((s) => s.activeProject);
  const [suggestions, setSuggestions] = useState<PromotionSuggestion[]>([]);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<Set<string>>(new Set());

  const loadSuggestions = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const { suggestions: data } = await api.getPromotionSuggestions(
        workspaceId,
        activeProject?.id,
      );
      setSuggestions(data);
    } catch (err) {
      console.error('Failed to load promotion suggestions:', err);
    }
  }, [workspaceId, activeProject]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handlePromote = async (entryId: string) => {
    if (!activeProject) return;
    setPromoting(entryId);
    try {
      await api.promoteMemory(entryId, activeProject.id);
      setPromoted((prev) => new Set(prev).add(entryId));
      // Reload suggestions after promotion
      loadSuggestions();
    } catch (err) {
      console.error('Failed to promote:', err);
    } finally {
      setPromoting(null);
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <ArrowUpCircle size={12} />
        <span>Promotion Candidates</span>
        <span className="text-zinc-600">({suggestions.length})</span>
      </div>

      {suggestions.map(({ entry, promotion }) => (
        <div
          key={entry.id}
          className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 text-[10px] rounded capitalize ${categoryColors[entry.category]}`}>
              {entry.category}
            </span>
            <span className="text-xs font-medium text-zinc-300 flex-1 truncate">
              {entry.key}
            </span>
            {promotion?.hasConflict && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-400" title="Conflicts with existing settings entry">
                <AlertTriangle size={10} />
                Conflict
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed mb-2 line-clamp-2">
            {entry.content}
          </p>

          <div className="flex items-center gap-2">
            {promotion && (
              <span className="text-[10px] text-zinc-600">
                → {promotion.label}
              </span>
            )}
            <div className="flex-1" />
            {promoted.has(entry.id) ? (
              <span className="flex items-center gap-1 text-[10px] text-green-400">
                <CheckCircle size={10} />
                Promoted
              </span>
            ) : (
              <button
                onClick={() => handlePromote(entry.id)}
                disabled={!activeProject || promoting === entry.id}
                className="px-2 py-0.5 text-[10px] bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors disabled:opacity-50"
              >
                {promoting === entry.id ? 'Promoting...' : 'Promote'}
              </button>
            )}
          </div>

          {entry.useCount > 0 && (
            <div className="mt-1 text-[10px] text-zinc-600">
              Used {entry.useCount} time{entry.useCount !== 1 ? 's' : ''}
              {entry.confidence < 1 && ` · ${(entry.confidence * 100).toFixed(0)}% confidence`}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
