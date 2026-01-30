import { useEffect } from 'react';
import type { ServerMessage } from '@cloudscode/shared';
import { wsClient } from '../lib/ws-client.js';
import { useChatStore } from '../stores/chat-store.js';
import { useAgentStore } from '../stores/agent-store.js';
import { useProjectStore } from '../stores/project-store.js';
import { useSettingsStore } from '../stores/settings-store.js';
import { useSetupPanelStore } from '../stores/setup-panel-store.js';

function handleMessage(message: ServerMessage): void {
  switch (message.type) {
    case 'chat:token': {
      if (message.payload.channel === 'setup') {
        const setup = useSetupPanelStore.getState();
        if (!setup.isStreaming) {
          setup.startStreaming();
        }
        setup.appendToken(message.payload.token);
      } else {
        const chat = useChatStore.getState();
        if (!chat.isStreaming) {
          chat.startStreaming();
        }
        chat.appendToken(message.payload.token);
      }
      break;
    }

    case 'chat:message': {
      if (message.payload.channel === 'setup') {
        const setup = useSetupPanelStore.getState();
        if (setup.isStreaming && message.payload.role === 'assistant') {
          setup.finishStreaming();
        }
      } else {
        const chat = useChatStore.getState();
        if (chat.isStreaming && message.payload.role === 'assistant') {
          chat.finishStreaming();
        }
      }
      // User messages are already added locally in MessageInput — don't duplicate
      break;
    }

    case 'chat:error': {
      if (message.payload.channel === 'setup') {
        useSetupPanelStore.getState().setError(message.payload.message);
      } else {
        useChatStore.getState().setError(message.payload.message);
      }
      break;
    }

    case 'agent:started': {
      useAgentStore.getState().addAgent(message.payload);
      break;
    }

    case 'agent:stopped': {
      useAgentStore.getState().updateAgent(message.payload);
      break;
    }

    case 'agent:tool': {
      useAgentStore.getState().addToolActivity(message.payload);
      break;
    }

    case 'agent:tool_result': {
      const { toolCallId, output, status, durationMs } = message.payload;
      useAgentStore.getState().updateToolResult(toolCallId, output, status, durationMs);
      break;
    }

    case 'agent:context': {
      const { agentId, sections } = message.payload;
      useAgentStore.getState().setAgentContext(agentId, sections);
      break;
    }

    case 'agent:result': {
      break;
    }

    case 'context:update': {
      useSettingsStore.getState().setContextBudget(message.payload);
      break;
    }

    case 'project:created':
    case 'project:resumed': {
      if (message.type === 'project:resumed') {
        useAgentStore.getState().clearAgents();
      }
      const projectStore = useProjectStore.getState();
      projectStore.setActiveProject(message.payload);
      if (message.type === 'project:created') {
        projectStore.addProject({
          id: message.payload.id,
          title: message.payload.title,
          status: message.payload.status,
          totalCostUsd: message.payload.totalCostUsd,
          updatedAt: message.payload.updatedAt,
          description: message.payload.description,
          primaryLanguage: message.payload.primaryLanguage,
          setupCompleted: message.payload.setupCompleted,
        });

        // If setup panel is open, set the project ID so chat input enables
        const setupPanel = useSetupPanelStore.getState();
        if (setupPanel.isOpen) {
          setupPanel.setSetupProjectId(message.payload.id);
          setupPanel.updateStepsFromProject(message.payload);
        }
      }
      break;
    }

    case 'project:list': {
      useProjectStore.getState().setProjects(message.payload.projects);
      break;
    }

    case 'project:messages': {
      const setupPanel = useSetupPanelStore.getState();
      const mappedMessages = message.payload.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        agentId: m.agentId ?? 'orchestrator',
        timestamp: m.createdAt * 1000,
      }));

      // Route to setup panel if it's open for this project
      if (setupPanel.isOpen && setupPanel.setupProjectId === message.payload.projectId) {
        setupPanel.loadMessages(mappedMessages);
      } else {
        useChatStore.getState().loadMessages(mappedMessages);
      }
      break;
    }

    case 'project:agents': {
      useAgentStore.getState().loadAgentHistory(message.payload.agents, message.payload.toolCalls);
      break;
    }

    case 'memory:updated': {
      break;
    }

    case 'project:settings_updated': {
      const projectStore = useProjectStore.getState();
      const { projectId, fullMetadata, projectFields } = message.payload;
      projectStore.updateProjectMetadata(projectId, fullMetadata);

      // Apply top-level project fields (title, primaryLanguage, directoryPath, etc.)
      if (projectFields && Object.keys(projectFields).length > 0) {
        projectStore.updateProjectFields(projectId, projectFields);
      }

      // Update setup panel step tracking if open for this project
      const setupPanel = useSetupPanelStore.getState();
      if (setupPanel.isOpen && setupPanel.setupProjectId === projectId) {
        // Re-read activeProject after fields were updated
        const activeProject = useProjectStore.getState().activeProject;
        if (activeProject && activeProject.id === projectId) {
          setupPanel.updateStepsFromProject(activeProject, fullMetadata);
        }
      }
      break;
    }

    case 'project:setup_completed': {
      useProjectStore.getState().markSetupCompleted(message.payload.projectId);

      // Auto-close setup panel if it matches
      const setupPanel = useSetupPanelStore.getState();
      if (setupPanel.isOpen && setupPanel.setupProjectId === message.payload.projectId) {
        // Re-read activeProject after markSetupCompleted updated it
        const updatedProject = useProjectStore.getState().activeProject;
        if (updatedProject) {
          setupPanel.updateStepsFromProject(updatedProject, updatedProject.metadata);
        }
        // Close panel after a brief delay to show completion state
        setTimeout(() => {
          useSetupPanelStore.getState().closePanel();
        }, 800);
      }
      break;
    }
  }
}

export function useWebSocket() {
  useEffect(() => {
    // connect() is a no-op if already connected, safe for StrictMode double-invoke
    wsClient.connect();

    const unsubscribe = wsClient.onMessage(handleMessage);

    return () => {
      // Only unsubscribe the handler; keep the singleton WS connection alive
      unsubscribe();
    };
  }, []);
}
