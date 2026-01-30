import { MessageList } from './MessageList.js';
import { MessageInput } from './MessageInput.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useSetupPanelStore } from '../../stores/setup-panel-store.js';
import { wsClient } from '../../lib/ws-client.js';
import { CloudLogo } from '../icons/CloudLogo.js';

function ResumeSetupBanner() {
  const handleResume = () => {
    const project = useProjectStore.getState().activeProject;
    if (!project) return;

    const setupPanel = useSetupPanelStore.getState();
    setupPanel.reset();
    setupPanel.setSetupProjectId(project.id);
    setupPanel.updateStepsFromProject(project, project.metadata);
    setupPanel.openPanel();

    // Resume the project on the server to load stored messages into the panel
    wsClient.send({
      type: 'project:resume',
      payload: { projectId: project.id },
    });
  };

  const handleSkip = () => {
    wsClient.send({ type: 'project:skip_setup' });
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-blue-950/40 border-b border-blue-800/30">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
        <span className="text-sm font-medium text-blue-300">Setup Incomplete</span>
        <button
          onClick={handleResume}
          className="ml-2 px-3 py-1 text-xs font-medium text-blue-100 bg-blue-700/60 hover:bg-blue-600/60 rounded-md transition-colors"
        >
          Resume Setup
        </button>
      </div>
      <button
        onClick={handleSkip}
        className="px-3 py-1 text-xs text-blue-300 hover:text-blue-100 bg-blue-900/50 hover:bg-blue-800/50 rounded-md transition-colors"
      >
        Skip Setup
      </button>
    </div>
  );
}

export function ChatView() {
  const activeProject = useProjectStore((s) => s.activeProject);
  const setupPanelOpen = useSetupPanelStore((s) => s.isOpen);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        <div className="text-center">
          <CloudLogo size={36} className="text-zinc-600 mx-auto mb-3" />
          <h2 className="text-xl mb-2">Welcome to CLouds Code</h2>
          <p className="text-sm">Create a new project to get started</p>
        </div>
      </div>
    );
  }

  const showResumeBanner = !activeProject.setupCompleted && !setupPanelOpen;

  return (
    <div className="flex flex-col h-full">
      {showResumeBanner && <ResumeSetupBanner />}
      <MessageList />
      <MessageInput />
    </div>
  );
}
