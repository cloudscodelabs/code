import type { HookCallback } from '@anthropic-ai/claude-code';
import { generateId, nowUnix } from '@cloudscode/shared';
import { getOrchestrator } from './orchestrator.js';
import { getDb } from '../db/database.js';
import { broadcast } from '../ws.js';
import { logger } from '../logger.js';

interface PendingToolCall {
  id: string;
  projectId: string;
  agentId: string;
  startedAt: number;
}

const pendingToolCalls = new Map<string, PendingToolCall>();

export const trackPreToolUse: HookCallback = async (input, toolUseID, _options) => {
  if (input.hook_event_name !== 'PreToolUse') return { continue: true };

  const toolInput = input as { tool_name: string; tool_input: unknown; session_id: string };
  logger.debug({ tool: toolInput.tool_name }, 'Pre tool use');

  const toolCallId = generateId();
  const orchestrator = getOrchestrator();
  const projectId = orchestrator.getProject()?.id ?? '';
  const agentId = orchestrator.getCurrentAgentNodeId() ?? toolInput.session_id;
  const startedAt = nowUnix();
  const inputStr = JSON.stringify(toolInput.tool_input ?? {});

  // Track pending tool call
  const useId = toolUseID ?? toolCallId;
  pendingToolCalls.set(useId, { id: toolCallId, projectId, agentId, startedAt });

  // Persist to database
  try {
    getDb().prepare(
      `INSERT INTO tool_calls (id, project_id, agent_id, tool_name, input, status, started_at)
       VALUES (?, ?, ?, ?, ?, 'running', ?)`
    ).run(toolCallId, projectId, agentId, toolInput.tool_name, inputStr, startedAt);
  } catch (err) {
    logger.error({ err, toolCallId }, 'Failed to persist tool call');
  }

  broadcast({
    type: 'agent:tool',
    payload: {
      id: toolCallId,
      agentId,
      toolName: toolInput.tool_name,
      input: (toolInput.tool_input as Record<string, unknown>) ?? {},
      status: 'running',
      timestamp: Date.now(),
    },
  });

  return { continue: true };
};

export const trackPostToolUse: HookCallback = async (input, toolUseID, _options) => {
  if (input.hook_event_name !== 'PostToolUse') return { continue: true };

  const toolInput = input as {
    tool_name: string;
    tool_input: unknown;
    tool_response: unknown;
    session_id: string;
  };

  logger.debug({ tool: toolInput.tool_name }, 'Post tool use');

  const useId = toolUseID ?? '';
  const pending = pendingToolCalls.get(useId);
  if (pending) {
    pendingToolCalls.delete(useId);

    const completedAt = nowUnix();
    const durationMs = (completedAt - pending.startedAt) * 1000;

    // Truncate output to 10KB
    let outputStr: string;
    try {
      outputStr = JSON.stringify(toolInput.tool_response ?? null);
      if (outputStr.length > 10240) {
        outputStr = outputStr.slice(0, 10240) + '...(truncated)';
      }
    } catch {
      outputStr = String(toolInput.tool_response ?? '');
      if (outputStr.length > 10240) {
        outputStr = outputStr.slice(0, 10240) + '...(truncated)';
      }
    }

    // Update database
    try {
      getDb().prepare(
        `UPDATE tool_calls SET output = ?, status = 'completed', duration_ms = ?, completed_at = ? WHERE id = ?`
      ).run(outputStr, durationMs, completedAt, pending.id);
    } catch (err) {
      logger.error({ err, toolCallId: pending.id }, 'Failed to update tool call');
    }

    broadcast({
      type: 'agent:tool_result',
      payload: {
        toolCallId: pending.id,
        agentId: pending.agentId,
        toolName: toolInput.tool_name,
        output: toolInput.tool_response,
        status: 'completed',
        durationMs,
      },
    });
  }

  return { continue: true };
};

export const trackSubagentStop: HookCallback = async (input, _toolUseID, _options) => {
  if (input.hook_event_name !== 'SubagentStop') return { continue: true };

  logger.info({ sessionId: input.session_id }, 'Subagent stopped');

  return { continue: true };
};

export const trackPreCompact: HookCallback = async (input, _toolUseID, _options) => {
  if (input.hook_event_name !== 'PreCompact') return { continue: true };

  logger.info({ sessionId: input.session_id }, 'Pre-compact event');

  // TODO: Flush important context to memory store before compaction
  return { continue: true };
};

/**
 * Creates hooks config for setup mode (uses orchestrator's getCurrentAgentNodeId).
 */
export function createHooksConfig() {
  return {
    PreToolUse: [{ hooks: [trackPreToolUse] }],
    PostToolUse: [{ hooks: [trackPostToolUse] }],
    SubagentStop: [{ hooks: [trackSubagentStop] }],
    PreCompact: [{ hooks: [trackPreCompact] }],
  };
}

/**
 * Creates hooks config for sub-agents, attributing tool calls to a specific
 * agent ID rather than the orchestrator's getCurrentAgentNodeId().
 */
export function createSubAgentHooksConfig(agentId: string, projectId: string) {
  const subPreToolUse: HookCallback = async (input, toolUseID, _options) => {
    if (input.hook_event_name !== 'PreToolUse') return { continue: true };

    const toolInput = input as { tool_name: string; tool_input: unknown; session_id: string };
    logger.debug({ tool: toolInput.tool_name, agentId }, 'Sub-agent pre tool use');

    const toolCallId = generateId();
    const startedAt = nowUnix();
    const inputStr = JSON.stringify(toolInput.tool_input ?? {});

    const useId = toolUseID ?? toolCallId;
    pendingToolCalls.set(useId, { id: toolCallId, projectId, agentId, startedAt });

    try {
      getDb().prepare(
        `INSERT INTO tool_calls (id, project_id, agent_id, tool_name, input, status, started_at)
         VALUES (?, ?, ?, ?, ?, 'running', ?)`
      ).run(toolCallId, projectId, agentId, toolInput.tool_name, inputStr, startedAt);
    } catch (err) {
      logger.error({ err, toolCallId }, 'Failed to persist sub-agent tool call');
    }

    broadcast({
      type: 'agent:tool',
      payload: {
        id: toolCallId,
        agentId,
        toolName: toolInput.tool_name,
        input: (toolInput.tool_input as Record<string, unknown>) ?? {},
        status: 'running',
        timestamp: Date.now(),
      },
    });

    return { continue: true };
  };

  return {
    PreToolUse: [{ hooks: [subPreToolUse] }],
    PostToolUse: [{ hooks: [trackPostToolUse] }],
    SubagentStop: [{ hooks: [trackSubagentStop] }],
    PreCompact: [{ hooks: [trackPreCompact] }],
  };
}
