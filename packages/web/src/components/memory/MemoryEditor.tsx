import { useState } from 'react';
import type { MemoryEntry, MemoryCategory } from '@cloudscode/shared';
import { MEMORY_CATEGORIES } from '@cloudscode/shared';
import { api } from '../../lib/api-client.js';

interface MemoryEditorProps {
  projectId: string; // Actually workspaceId for memory operations
  entry: MemoryEntry | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function MemoryEditor({ projectId: workspaceId, entry, onSaved, onCancel }: MemoryEditorProps) {
  const [category, setCategory] = useState<MemoryCategory>(entry?.category ?? 'fact');
  const [key, setKey] = useState(entry?.key ?? '');
  const [content, setContent] = useState(entry?.content ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!key.trim() || !content.trim()) return;
    setSaving(true);
    try {
      if (entry) {
        await api.updateMemory(entry.id, { category, key, content });
      } else {
        await api.createMemory({ workspaceId, category, key, content });
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save memory:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-900 space-y-2">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as MemoryCategory)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none"
      >
        {MEMORY_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Key (e.g., 'project uses pnpm')"
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none"
      />

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Content..."
        rows={3}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none"
      />

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !key.trim() || !content.trim()}
          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : entry ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  );
}
