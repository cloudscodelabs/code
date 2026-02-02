import { useState, useEffect, useCallback } from 'react';
import { usePlanPanelStore } from '../../stores/plan-panel-store.js';
import { wsClient } from '../../lib/ws-client.js';
import { PlansPanelHeader } from './PlansPanelHeader.js';
import { PlansPanelBody } from './PlansPanelBody.js';

export function PlansPanel() {
  const isOpen = usePlanPanelStore((s) => s.isOpen);
  const isStreaming = usePlanPanelStore((s) => s.isStreaming);
  const currentPlan = usePlanPanelStore((s) => s.currentPlan);
  const view = usePlanPanelStore((s) => s.view);
  const hasPlan = currentPlan !== null && view !== 'list';

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
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mounted]);

  const handleClose = useCallback(() => {
    if (isStreaming) {
      wsClient.send({ type: 'plan:interrupt' });
    }
    usePlanPanelStore.getState().closePanel();
  }, [isStreaming]);

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
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Panel — slides from right */}
      <div
        className={`absolute top-0 right-0 bottom-0 w-full bg-zinc-900 border-l border-zinc-700 flex flex-col transition-[transform,max-width] duration-300 ease-out ${
          hasPlan ? 'max-w-7xl' : 'max-w-4xl'
        } ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <PlansPanelHeader onClose={handleClose} />
        <PlansPanelBody />
      </div>
    </div>
  );
}
