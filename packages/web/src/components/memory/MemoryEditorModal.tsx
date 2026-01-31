import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { MemoryCategory, MemoryScope } from '@cloudscode/shared';
import { MEMORY_CATEGORIES } from '@cloudscode/shared';
import { useMemoryStore } from '../../stores/memory-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { api } from '../../lib/api-client.js';

export function MemoryEditorModal() {
  const editorOpen = useMemoryStore((s) => s.editorOpen);
  const editingEntry = useMemoryStore((s) => s.editingEntry);
  const closeEditor = useMemoryStore((s) => s.closeEditor);
  const workspaceId = useProjectStore((s) => s.workspaceId);

  const [category, setCategory] = useState<MemoryCategory>('fact');
  const [key, setKey] = useState('');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<MemoryScope>('workspace');
  const [confidence, setConfidence] = useState(1);
  const [saving, setSaving] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Reset form when editing entry changes
  useEffect(() => {
    if (editorOpen) {
      setCategory(editingEntry?.category ?? 'fact');
      setKey(editingEntry?.key ?? '');
      setContent(editingEntry?.content ?? '');
      setScope(editingEntry?.scope ?? 'workspace');
      setConfidence(editingEntry?.confidence ?? 1);
    }
  }, [editorOpen, editingEntry]);

  // Mount/unmount animation
  useEffect(() => {
    if (editorOpen) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else if (mounted) {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [editorOpen, mounted]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEditor();
    },
    [closeEditor],
  );

  useEffect(() => {
    if (mounted) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [mounted, handleKeyDown]);

  const handleSave = async () => {
    if (!key.trim() || !content.trim() || !workspaceId) return;
    setSaving(true);
    try {
      if (editingEntry) {
        await api.updateMemory(editingEntry.id, { category, key, content, scope, confidence });
      } else {
        await api.createMemory({ workspaceId, category, key, content, scope });
      }
      closeEditor();
      // Notify parent to refresh
      window.dispatchEvent(new CustomEvent('memory-entries-changed'));
    } catch (err) {
      console.error('Failed to save memory:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeEditor}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl transition-all duration-200 ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-100">
            {editingEntry ? 'Edit Entry' : 'New Entry'}
          </h3>
          <button
            onClick={closeEditor}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Category dropdown */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MemoryCategory)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
            >
              {MEMORY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Scope radio buttons */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Scope</label>
            <div className="flex gap-2">
              {(['workspace', 'project'] as const).map((s) => (
                <label
                  key={s}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs cursor-pointer border transition-colors ${
                    scope === s
                      ? 'bg-zinc-700 border-zinc-600 text-zinc-200'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="modal-scope"
                    value={s}
                    checked={scope === s}
                    onChange={() => setScope(s)}
                    className="hidden"
                  />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Key input */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Key</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g., 'project uses pnpm'"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>

          {/* Content textarea */}
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe the knowledge entry..."
              rows={6}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600"
            />
          </div>

          {/* Confidence slider (edit only) */}
          {editingEntry && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">
                Confidence: {(confidence * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={confidence * 100}
                onChange={(e) => setConfidence(Number(e.target.value) / 100)}
                className="w-full accent-blue-500"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button
            onClick={closeEditor}
            className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !key.trim() || !content.trim()}
            className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : editingEntry ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
