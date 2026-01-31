import { useState, useEffect } from 'react';
import { Settings, Activity, Map, Brain, BarChart3, Minus, Square, Copy, X } from 'lucide-react';
import { useProjectStore } from '../../stores/project-store.js';
import { useSettingsStore } from '../../stores/settings-store.js';
import { usePlanPanelStore } from '../../stores/plan-panel-store.js';
import { useAgentStore } from '../../stores/agent-store.js';
import { useMemoryStore } from '../../stores/memory-store.js';

function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    window.electronAPI?.isMaximized().then(setMaximized);
    const cleanup = window.electronAPI?.onMaximizedChange(setMaximized);
    return () => cleanup?.();
  }, []);

  return (
    <div className="flex items-center titlebar-no-drag">
      <button
        onClick={() => window.electronAPI?.minimize()}
        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        title="Minimize"
      >
        <Minus size={16} />
      </button>
      <button
        onClick={() => window.electronAPI?.maximize()}
        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? <Copy size={16} /> : <Square size={16} />}
      </button>
      <button
        onClick={() => window.electronAPI?.close()}
        className="p-1.5 rounded hover:bg-red-600/80 hover:text-white text-zinc-400 transition-colors"
        title="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function TopBar() {
  const isElectron = !!window.electronAPI?.isElectron || /electron/i.test(navigator.userAgent);
  const activeProject = useProjectStore((s) => s.activeProject);
  const openProjectSettings = useSettingsStore((s) => s.openProjectSettings);
  const openAgentDetailPanel = useSettingsStore((s) => s.openAgentDetailPanel);
  const openMemoryPanel = useSettingsStore((s) => s.openMemoryPanel);
  const openTokenStatsPanel = useSettingsStore((s) => s.openTokenStatsPanel);
  const tokenStatsPanelOpen = useSettingsStore((s) => s.tokenStatsPanelOpen);
  const contextBudget = useSettingsStore((s) => s.contextBudget);
  const planPanelOpen = usePlanPanelStore((s) => s.isOpen);
  const isExecuting = usePlanPanelStore((s) => s.isExecuting);
  const togglePlanPanel = usePlanPanelStore((s) => s.togglePanel);
  const agents = useAgentStore((s) => s.agents);
  const hasRunningAgents = Array.from(agents.values()).some((a) => a.status === 'running');
  const memoryFlashKey = useMemoryStore((s) => s.memoryFlashKey);

  return (
    <header
      className={`h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-925${isElectron ? ' titlebar-drag' : ''}`}
      onDoubleClick={isElectron ? () => window.electronAPI?.maximize() : undefined}
    >
      <div className="flex items-center gap-3 titlebar-no-drag">
        <span className="text-sm text-zinc-300">
          {activeProject?.title ?? (activeProject ? `Project ${activeProject.id.slice(0, 8)}` : 'No active project')}
        </span>
        {activeProject && (
          <span className="text-xs text-zinc-500">
            {activeProject.status}
          </span>
        )}
        {activeProject && (
          <button
            onClick={openProjectSettings}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Project Settings"
          >
            <Settings size={16} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 titlebar-no-drag">
        <button
          onClick={openTokenStatsPanel}
          className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${
            tokenStatsPanelOpen
              ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
              : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
          title="Token Statistics"
        >
          <BarChart3 size={16} />
          {contextBudget && (
            <span className="text-xs font-mono">
              {contextBudget.totalTokens.toLocaleString()} / ${contextBudget.costUsd.toFixed(4)}
            </span>
          )}
        </button>

        <button
          onClick={togglePlanPanel}
          className={`p-1.5 rounded transition-colors ${
            isExecuting
              ? 'topbar-heartbeat-green'
              : planPanelOpen
                ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
          title="Plans (Cmd+Shift+P)"
        >
          <Map size={18} />
        </button>

        <button
          onClick={openAgentDetailPanel}
          className={`p-1.5 rounded transition-colors ${
            hasRunningAgents
              ? 'topbar-heartbeat-blue'
              : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
          title="Agent Activity"
        >
          <Activity size={18} />
        </button>

        <button
          key={memoryFlashKey}
          onClick={openMemoryPanel}
          className={`p-1.5 rounded transition-colors ${
            memoryFlashKey > 0
              ? 'topbar-memory-flash'
              : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
          title="Knowledge Base"
        >
          <Brain size={18} />
        </button>

        {isElectron && (
          <>
            <div className="w-px h-5 bg-zinc-700" />
            <WindowControls />
          </>
        )}
      </div>
    </header>
  );
}
