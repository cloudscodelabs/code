import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Trash2, Tag } from 'lucide-react';
import type { MemoryEntry, MemoryCategory } from '@cloudscode/shared';
import { MEMORY_CATEGORIES } from '@cloudscode/shared';
import { useProjectStore } from '../../stores/project-store.js';
import { api } from '../../lib/api-client.js';
import { MemoryEditor } from './MemoryEditor.js';

const categoryColors: Record<MemoryCategory, string> = {
  architecture: 'text-purple-400 bg-purple-400/10',
  convention: 'text-blue-400 bg-blue-400/10',
  decision: 'text-green-400 bg-green-400/10',
  fact: 'text-yellow-400 bg-yellow-400/10',
  issue: 'text-red-400 bg-red-400/10',
};

export function KnowledgeBase() {
  const projectId = useProjectStore((s) => s.workspaceId);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MemoryCategory | ''>('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MemoryEntry | null>(null);

  const loadEntries = useCallback(async () => {
    if (!projectId) return;
    try {
      if (search) {
        const { results } = await api.searchMemory(projectId, search);
        setEntries(results.map((r: any) => r.entry));
      } else {
        const { entries } = await api.listMemory(projectId, filter || undefined);
        setEntries(entries);
      }
    } catch (err) {
      console.error('Failed to load memory:', err);
    }
  }, [projectId, search, filter]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMemory(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  const handleSaved = () => {
    setShowEditor(false);
    setEditingEntry(null);
    loadEntries();
  };

  if (!projectId) {
    return <div className="p-4 text-sm text-zinc-500">No project loaded.</div>;
  }

  return (
    <div className="p-3 space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search knowledge..."
          className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setFilter('')}
          className={`px-2 py-1 text-xs rounded ${!filter ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          All
        </button>
        {MEMORY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-2 py-1 text-xs rounded capitalize ${filter === cat ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={() => {
          setEditingEntry(null);
          setShowEditor(true);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors"
      >
        <Plus size={14} />
        Add Entry
      </button>

      {/* Editor */}
      {showEditor && (
        <MemoryEditor
          projectId={projectId}
          entry={editingEntry}
          onSaved={handleSaved}
          onCancel={() => {
            setShowEditor(false);
            setEditingEntry(null);
          }}
        />
      )}

      {/* Entry list */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-1.5 py-0.5 text-[10px] rounded capitalize ${categoryColors[entry.category]}`}>
                {entry.category}
              </span>
              <span className="text-xs font-medium text-zinc-300 flex-1 truncate">
                {entry.key}
              </span>
              <button
                onClick={() => {
                  setEditingEntry(entry);
                  setShowEditor(true);
                }}
                className="text-zinc-600 hover:text-zinc-300 p-1"
              >
                <Tag size={12} />
              </button>
              <button
                onClick={() => handleDelete(entry.id)}
                className="text-zinc-600 hover:text-red-400 p-1"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">{entry.content}</p>
            {entry.confidence < 1 && (
              <div className="mt-1 text-[10px] text-zinc-600">
                Confidence: {(entry.confidence * 100).toFixed(0)}%
              </div>
            )}
          </div>
        ))}

        {entries.length === 0 && (
          <div className="text-sm text-zinc-600 text-center py-4">
            {search ? 'No results found' : 'No knowledge entries yet'}
          </div>
        )}
      </div>
    </div>
  );
}
