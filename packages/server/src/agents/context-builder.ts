import type { AgentType, AgentContextSection, Project, MemoryEntry } from '@cloudscode/shared';
import { MAX_MEMORY_INJECTION_ENTRIES } from '@cloudscode/shared';
import { getAgentDefinition, type ContextHints } from './agent-definitions.js';
import { getContextManager } from '../context/context-manager.js';
import { getMemoryStore, detectTaskIntent } from '../context/memory-store.js';
import { getSummaryCache } from '../context/summary-cache.js';
import { getWorkspaceFiles } from '../workspace/workspace-files.js';
import { getProjectManager } from '../projects/project-manager.js';
import { buildUnifiedKnowledge } from './knowledge-dedup.js';
import { logger } from '../logger.js';

const MAX_CONVERSATION_CONTEXT_LENGTH = 500;

/**
 * Caches shared context across subagents within a single plan execution.
 * Project context, workspace files, session summary, and conversation are
 * identical for agents in the same plan run — only memory search differs.
 */
export class ExecutionContextCache {
  private projectCtx: string | null | undefined = undefined; // undefined = not yet fetched
  private workspaceCtx: string | null | undefined = undefined;
  private sessionSummary: string | null | undefined = undefined;
  private conversationCtx: string | null | undefined = undefined;

  getProjectContext(project: Project): string | null {
    if (this.projectCtx === undefined) {
      this.projectCtx = buildProjectContext(project);
    }
    return this.projectCtx;
  }

  getWorkspaceContext(): string | null {
    if (this.workspaceCtx === undefined) {
      try {
        const workspaceFiles = getWorkspaceFiles();
        this.workspaceCtx = workspaceFiles.getContext();
      } catch {
        this.workspaceCtx = null;
      }
    }
    return this.workspaceCtx;
  }

  getSessionSummary(projectId: string): string | null {
    if (this.sessionSummary === undefined) {
      try {
        const summaryCache = getSummaryCache();
        this.sessionSummary = summaryCache.getSummary(projectId);
      } catch {
        this.sessionSummary = null;
      }
    }
    return this.sessionSummary;
  }

  getConversationContext(projectId: string): string | null {
    if (this.conversationCtx === undefined) {
      try {
        const projectManager = getProjectManager();
        const recentMessages = projectManager.getRecentMessages(projectId, 10);
        if (recentMessages.length > 0) {
          this.conversationCtx = recentMessages.map((m) => {
            const content = m.content.length > MAX_CONVERSATION_CONTEXT_LENGTH
              ? m.content.slice(0, MAX_CONVERSATION_CONTEXT_LENGTH) + '...'
              : m.content;
            return `${m.role}: ${content}`;
          }).join('\n');
        } else {
          this.conversationCtx = null;
        }
      } catch {
        this.conversationCtx = null;
      }
    }
    return this.conversationCtx;
  }
}

export interface ContextPackage {
  systemPrompt: string;
  agentType: AgentType;
  sections: AgentContextSection[];
}

/**
 * Builds a context package for a sub-agent, assembling the system prompt
 * with conditionally included context sections based on agent defaults
 * and per-task overrides.
 */
export function buildContextPackage(
  project: Project,
  agentType: Exclude<AgentType, 'orchestrator'>,
  taskDescription: string,
  contextHintOverrides?: Partial<ContextHints>,
  cache?: ExecutionContextCache,
): ContextPackage {
  const definition = getAgentDefinition(agentType);

  // Merge per-task hint overrides with agent defaults
  const hints: ContextHints = {
    ...definition.defaultContextHints,
    ...contextHintOverrides,
  };

  const parts: string[] = [definition.systemPrompt];
  const sections: AgentContextSection[] = [];

  // System prompt (always included)
  sections.push({ name: 'System Prompt', included: true, content: definition.systemPrompt });

  // Task description
  parts.push(`\n\n## Your Task\n${taskDescription}`);
  sections.push({ name: 'Task', included: true, content: taskDescription });

  // Unified Project Knowledge (settings + memory, deduplicated)
  if (hints.projectContext || hints.memory) {
    let unifiedContent: string | null = null;
    try {
      const projectCtx = hints.projectContext
        ? (cache ? cache.getProjectContext(project) : buildProjectContext(project))
        : null;
      let memoryEntries: MemoryEntry[] = [];

      if (hints.memory) {
        try {
          const memoryStore = getMemoryStore();
          const intent = detectTaskIntent(taskDescription);
          const results = memoryStore.searchByProjectWithIntent(
            project.workspaceId, project.id, taskDescription, intent, MAX_MEMORY_INJECTION_ENTRIES,
          );
          memoryEntries = results.map((r) => r.entry);
        } catch {
          logger.debug('MemoryStore not available for unified context');
        }
      }

      const unified = buildUnifiedKnowledge(
        projectCtx,
        memoryEntries,
        project.metadata,
        project.updatedAt,
      );

      if (unified) {
        parts.push(`\n\n## Project Knowledge\n${unified}`);
        unifiedContent = unified;
      }
    } catch {
      logger.debug('Failed to build unified knowledge context');
    }
    sections.push({ name: 'Project Knowledge', included: true, content: unifiedContent });
  } else {
    sections.push({ name: 'Project Knowledge', included: false, content: null });
  }

  // Workspace files (PROJECT.md, CONVENTIONS.md)
  if (hints.workspaceFiles) {
    let wsContent: string | null = null;
    if (cache) {
      wsContent = cache.getWorkspaceContext();
    } else {
      try {
        const workspaceFiles = getWorkspaceFiles();
        wsContent = workspaceFiles.getContext();
      } catch {
        logger.debug('WorkspaceFiles not available for context package');
      }
    }
    if (wsContent) {
      parts.push(`\n\n## Workspace Files\n${wsContent}`);
    }
    sections.push({ name: 'Workspace Files', included: true, content: wsContent });
  } else {
    sections.push({ name: 'Workspace Files', included: false, content: null });
  }

  // Session summary
  if (hints.summary) {
    let summaryContent: string | null = null;
    if (cache) {
      summaryContent = cache.getSessionSummary(project.id);
    } else {
      try {
        const summaryCache = getSummaryCache();
        summaryContent = summaryCache.getSummary(project.id);
      } catch {
        logger.debug('SummaryCache not available for context package');
      }
    }
    if (summaryContent) {
      parts.push(`\n\n## Session State\n${summaryContent}`);
    }
    sections.push({ name: 'Session Summary', included: true, content: summaryContent });
  } else {
    sections.push({ name: 'Session Summary', included: false, content: null });
  }

  // Conversation context (recent chat messages)
  if (hints.conversationContext) {
    let convContent: string | null = null;
    if (cache) {
      convContent = cache.getConversationContext(project.id);
    } else {
      try {
        const projectManager = getProjectManager();
        const recentMessages = projectManager.getRecentMessages(project.id, 10);
        if (recentMessages.length > 0) {
          convContent = recentMessages.map((m) => {
            const content = m.content.length > MAX_CONVERSATION_CONTEXT_LENGTH
              ? m.content.slice(0, MAX_CONVERSATION_CONTEXT_LENGTH) + '...'
              : m.content;
            return `${m.role}: ${content}`;
          }).join('\n');
        }
      } catch {
        logger.debug('ProjectManager not available for conversation context');
      }
    }
    if (convContent) {
      parts.push(`\n\n## Recent Conversation\n${convContent}`);
    }
    sections.push({ name: 'Conversation', included: true, content: convContent });
  } else {
    sections.push({ name: 'Conversation', included: false, content: null });
  }

  return {
    systemPrompt: parts.join(''),
    agentType,
    sections,
  };
}

/**
 * Builds project context string from project metadata.
 * Extracted from the old orchestrator.ts buildProjectContext() method.
 */
export function buildProjectContext(project: Project): string | null {
  const parts: string[] = [];

  if (project.title) parts.push(`Name: ${project.title}`);
  if (project.purpose) parts.push(`Purpose: ${project.purpose}`);
  if (project.primaryLanguage) parts.push(`Primary language: ${project.primaryLanguage}`);
  if (project.architecturePattern) parts.push(`Architecture: ${project.architecturePattern}`);

  const meta = project.metadata;

  // AI custom instructions
  if (meta.ai?.customInstructions) {
    parts.push(`\nAI Instructions: ${meta.ai.customInstructions}`);
  }

  // Avoid paths
  if (Array.isArray(meta.ai?.avoidPaths) && meta.ai.avoidPaths.length > 0) {
    parts.push(`Avoid paths: ${meta.ai.avoidPaths.join(', ')}`);
  }

  // Key conventions (top 5)
  if (Array.isArray(meta.codingStandards) && meta.codingStandards.length > 0) {
    const top = meta.codingStandards.slice(0, 5);
    parts.push(`\nConventions:\n${top.map((s) => `- ${s.rule}: ${s.description}`).join('\n')}`);
  }

  // Active services
  if (Array.isArray(meta.services) && meta.services.length > 0) {
    parts.push(`Services: ${meta.services.map((s) => s.name).join(', ')}`);
  }

  // Tech stack
  if (Array.isArray(meta.techStack) && meta.techStack.length > 0) {
    const primary = meta.techStack.filter((t) => t.isPrimary);
    if (primary.length > 0) {
      parts.push(`Tech stack: ${primary.map((t) => `${t.name}${t.version ? ` ${t.version}` : ''}`).join(', ')}`);
    }
  }

  return parts.length > 0 ? parts.join('\n') : null;
}
