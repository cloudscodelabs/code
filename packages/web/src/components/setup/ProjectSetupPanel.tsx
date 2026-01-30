import { useState, useEffect, useCallback } from 'react';
import { useSetupPanelStore } from '../../stores/setup-panel-store.js';
import { useSettingsStore } from '../../stores/settings-store.js';
import { wsClient } from '../../lib/ws-client.js';
import { SetupStepIndicator } from './SetupStepIndicator.js';
import { SetupPanelHeader } from './SetupPanelHeader.js';
import { SetupChatArea } from './SetupChatArea.js';

export function ProjectSetupPanel() {
  const isOpen = useSetupPanelStore((s) => s.isOpen);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Mount then animate in
  useEffect(() => {
    if (isOpen) {
      // Close project settings panel if open
      useSettingsStore.getState().closeProjectSettings();

      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    } else if (mounted) {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mounted]);

  const handleClose = useCallback(() => {
    // Interrupt any running AI
    wsClient.send({ type: 'chat:interrupt' });
    useSetupPanelStore.getState().closePanel();
  }, []);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    },
    [handleClose],
  );

  useEffect(() => {
    if (mounted) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [mounted, handleKeyDown]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop — does NOT close on click to prevent accidental dismiss */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel — drops from top */}
      <div
        className={`absolute top-0 left-0 right-0 h-[65vh] bg-zinc-900 border-b border-zinc-700 flex flex-col transition-transform duration-300 ease-out ${
          visible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <SetupPanelHeader onClose={handleClose} />
        <SetupStepIndicator />
        <SetupChatArea />
      </div>
    </div>
  );
}
