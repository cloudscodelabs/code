import { X } from 'lucide-react';
import { wsClient } from '../../lib/ws-client.js';
import { useSetupPanelStore } from '../../stores/setup-panel-store.js';

interface SetupPanelHeaderProps {
  onClose: () => void;
}

export function SetupPanelHeader({ onClose }: SetupPanelHeaderProps) {
  const handleSkip = () => {
    wsClient.send({ type: 'project:skip_setup' });
    useSetupPanelStore.getState().closePanel();
  };

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-700">
      <div>
        <h2 className="text-base font-medium text-zinc-100">New Project Setup</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Answer a few questions to configure your project, or skip to start coding.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSkip}
          className="px-3 py-1.5 text-xs text-zinc-300 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
        >
          Skip Setup
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
