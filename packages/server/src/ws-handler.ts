import type { WebSocket } from 'ws';
import type { ClientMessage } from '@cloudscode/shared';
import { logger } from './logger.js';
import { sendTo, broadcast } from './ws.js';
import { getDb } from './db/database.js';
import { getProjectManager } from './projects/project-manager.js';
import { getOrchestrator } from './agents/orchestrator.js';
import { getAgentManager } from './agents/agent-manager.js';

export function handleClientMessage(ws: WebSocket, message: ClientMessage): void {
  switch (message.type) {
    case 'chat:send':
      handleChatSend(ws, message.payload.content, message.payload.model);
      break;
    case 'chat:interrupt':
      handleChatInterrupt(ws);
      break;
    case 'project:create':
      handleProjectCreate(ws, message.payload.workspaceId, message.payload.title, message.payload.skipSetup);
      break;
    case 'project:resume':
      handleProjectResume(ws, message.payload.projectId);
      break;
    case 'project:skip_setup':
      handleSkipSetup(ws);
      break;
    case 'agent:interrupt':
      handleAgentInterrupt(ws, message.payload.agentId);
      break;
    default:
      logger.warn({ type: (message as any).type }, 'Unknown message type');
  }
}

async function handleChatSend(ws: WebSocket, content: string, model?: string): Promise<void> {
  try {
    const orchestrator = getOrchestrator();
    await orchestrator.handleMessage(content, ws, { model });
  } catch (err) {
    logger.error({ err }, 'Error handling chat message');
    sendTo(ws, {
      type: 'chat:error',
      payload: { message: err instanceof Error ? err.message : 'Internal error' },
    });
  }
}

function handleChatInterrupt(_ws: WebSocket): void {
  const orchestrator = getOrchestrator();
  orchestrator.interrupt();
}

function handleAgentInterrupt(_ws: WebSocket, agentId: string): void {
  const orchestrator = getOrchestrator();
  const interrupted = orchestrator.interruptAgent(agentId);
  if (!interrupted) {
    logger.warn({ agentId }, 'Agent interrupt requested but no active controller found');
  }
}

async function handleProjectCreate(ws: WebSocket, workspaceId: string, title?: string, skipSetup?: boolean): Promise<void> {
  try {
    const projectManager = getProjectManager();
    const setupCompleted = skipSetup === true;
    const project = projectManager.createProject(workspaceId, title, {
      setupCompleted,
    });

    const orchestrator = getOrchestrator();
    orchestrator.setProject(project);

    sendTo(ws, { type: 'project:created', payload: project });

    // Auto-trigger setup flow if not skipping
    if (!setupCompleted) {
      orchestrator.handleMessage('Start the project setup.', ws, { persist: false }).catch((err) => {
        logger.error({ err }, 'Error auto-triggering project setup');
      });
    }
  } catch (err) {
    logger.error({ err }, 'Error creating project');
    sendTo(ws, {
      type: 'chat:error',
      payload: { message: 'Failed to create project' },
    });
  }
}

async function handleSkipSetup(ws: WebSocket): Promise<void> {
  try {
    const orchestrator = getOrchestrator();
    const project = orchestrator.getProject();
    if (!project) {
      sendTo(ws, {
        type: 'chat:error',
        payload: { message: 'No active project' },
      });
      return;
    }

    const projectManager = getProjectManager();
    projectManager.markSetupCompleted(project.id);

    // Refresh the orchestrator's project reference
    const refreshed = projectManager.getProject(project.id);
    if (refreshed) orchestrator.setProject(refreshed);

    broadcast({
      type: 'project:setup_completed',
      payload: { projectId: project.id },
    });

    // Interrupt any ongoing setup conversation
    orchestrator.interrupt();
  } catch (err) {
    logger.error({ err }, 'Error skipping setup');
    sendTo(ws, {
      type: 'chat:error',
      payload: { message: 'Failed to skip setup' },
    });
  }
}

async function handleProjectResume(ws: WebSocket, projectId: string): Promise<void> {
  try {
    const projectManager = getProjectManager();
    const project = projectManager.getProject(projectId);
    if (!project) {
      sendTo(ws, {
        type: 'chat:error',
        payload: { message: `Project ${projectId} not found` },
      });
      return;
    }

    const orchestrator = getOrchestrator();
    orchestrator.setProject(project);

    sendTo(ws, { type: 'project:resumed', payload: project });

    // Send stored message history
    const messages = projectManager.getMessages(projectId);
    if (messages.length > 0) {
      sendTo(ws, {
        type: 'project:messages',
        payload: { projectId, messages },
      });
    }

    // Send agent history and tool calls
    try {
      const agents = getAgentManager().getAgentHistory(projectId);
      const toolCallRows = getDb().prepare(
        `SELECT id, project_id, agent_id, tool_name, input, output, status, duration_ms, started_at, completed_at
         FROM tool_calls WHERE project_id = ? ORDER BY started_at ASC LIMIT 200`
      ).all(projectId) as any[];

      const toolCalls = toolCallRows.map((r: any) => ({
        id: r.id,
        projectId: r.project_id,
        agentId: r.agent_id,
        toolName: r.tool_name,
        input: r.input,
        output: r.output,
        status: r.status,
        durationMs: r.duration_ms,
        startedAt: r.started_at,
        completedAt: r.completed_at,
      }));

      if (agents.length > 0 || toolCalls.length > 0) {
        sendTo(ws, {
          type: 'project:agents',
          payload: { projectId, agents, toolCalls },
        });
      }
    } catch (err) {
      logger.error({ err }, 'Error loading agent history');
    }
  } catch (err) {
    logger.error({ err }, 'Error resuming project');
    sendTo(ws, {
      type: 'chat:error',
      payload: { message: 'Failed to resume project' },
    });
  }
}
