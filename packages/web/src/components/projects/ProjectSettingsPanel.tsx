import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useSettingsStore } from '../../stores/settings-store.js';
import { ProjectEditor } from './ProjectEditor.js';

export function ProjectSettingsPanel() {
  const isOpen = useSettingsStore((s) => s.projectSettingsOpen);
  const closeProjectSettings = useSettingsStore((s) => s.closeProjectSettings);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Mount then animate in
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else if (mounted) {
      // Animate out then unmount
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mounted]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeProjectSettings();
    },
    [closeProjectSettings],
  );

  useEffect(() => {
    if (mounted) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [mounted, handleKeyDown]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeProjectSettings}
      />

      {/* Panel */}
      <div
        className={`absolute top-0 right-0 h-full w-full max-w-3xl bg-zinc-900 border-l border-zinc-700 flex flex-col transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <h2 className="text-base font-medium text-zinc-100">Project Settings</h2>
          <button
            onClick={closeProjectSettings}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <ProjectEditor />
        </div>
      </div>
    </div>
  );
}
