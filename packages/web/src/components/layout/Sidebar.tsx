import { Plus, MessageSquare, Trash2, Settings } from 'lucide-react';
import { CloudLogo } from '../icons/CloudLogo.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useSettingsStore } from '../../stores/settings-store.js';
import { useChatStore } from '../../stores/chat-store.js';
import { useSetupPanelStore } from '../../stores/setup-panel-store.js';
import { wsClient } from '../../lib/ws-client.js';
import { api } from '../../lib/api-client.js';

export function Sidebar() {
  const projects = useProjectStore((s) => s.projects);
  const activeProject = useProjectStore((s) => s.activeProject);
  const workspaceId = useProjectStore((s) => s.workspaceId);
  const removeProject = useProjectStore((s) => s.removeProject);
  const openSettingsModal = useSettingsStore((s) => s.openSettingsModal);

  const handleNewProject = () => {
    if (!workspaceId) return;
    // Open setup panel first, then create project on server
    const setupPanel = useSetupPanelStore.getState();
    setupPanel.reset();
    setupPanel.openPanel();
    wsClient.send({
      type: 'project:create',
      payload: { workspaceId },
    });
    useChatStore.getState().clearMessages();
  };

  const handleResumeProject = (projectId: string) => {
    // Clear current messages — server will send stored history via project:messages
    useChatStore.getState().clearMessages();
    wsClient.send({
      type: 'project:resume',
      payload: { projectId },
    });
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    try {
      await api.deleteProject(projectId);
      removeProject(projectId);
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  return (
    <aside className="w-60 bg-zinc-925 border-r border-zinc-800 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <CloudLogo size={22} className="text-zinc-300" />
          CLouds Code
        </h1>
      </div>

      <div className="p-3">
        <button
          onClick={handleNewProject}
          disabled={!workspaceId}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm transition-colors disabled:opacity-50"
        >
          <Plus size={16} />
          New Project
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {projects.map((project) => (
          <div
            key={project.id}
            role="button"
            tabIndex={0}
            onClick={() => handleResumeProject(project.id)}
            onKeyDown={(e) => e.key === 'Enter' && handleResumeProject(project.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left mb-1 group transition-colors cursor-pointer ${
              activeProject?.id === project.id
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
            }`}
          >
            <MessageSquare size={14} className="shrink-0" />
            <span className="truncate flex-1">
              {project.title ?? `Project ${project.id.slice(0, 8)}`}
            </span>
            {!project.setupCompleted && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium text-blue-300 bg-blue-900/50 rounded">
                Setup
              </span>
            )}
            <button
              onClick={(e) => handleDeleteProject(e, project.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-zinc-800 flex items-center justify-between">
        <span className="text-xs text-zinc-500 truncate">
          {workspaceId ? `Workspace: ${workspaceId.slice(0, 8)}...` : 'No workspace'}
        </span>
        <button
          onClick={openSettingsModal}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors rounded-md hover:bg-zinc-800"
          title="Settings"
        >
          <Settings size={14} />
        </button>
      </div>
    </aside>
  );
}
