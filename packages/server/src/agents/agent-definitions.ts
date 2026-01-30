import type { AgentType } from '@cloudscode/shared';

export interface ContextHints {
  memory: boolean;
  workspaceFiles: boolean;
  summary: boolean;
  projectContext: boolean;
  conversationContext: boolean;
}

export interface AgentDefinition {
  type: AgentType;
  name: string;
  description: string;
  allowedTools: string[];
  systemPrompt: string;
  model?: string;
  defaultContextHints: ContextHints;
}

export const agentDefinitions: Record<Exclude<AgentType, 'orchestrator'>, AgentDefinition> = {
  'code-analyst': {
    type: 'code-analyst',
    name: 'Code Analyst',
    description: 'Explores code, finds patterns, traces dependencies, and analyzes architecture.',
    allowedTools: ['FileRead', 'Grep', 'Glob'],
    systemPrompt: `You are a code analyst. Your role is to explore codebases, find patterns, trace dependencies, and provide detailed analysis. You have read-only access to the codebase. Provide clear, structured summaries of your findings.`,
    defaultContextHints: { memory: true, workspaceFiles: true, summary: true, projectContext: true, conversationContext: true },
  },
  'implementer': {
    type: 'implementer',
    name: 'Implementer',
    description: 'Writes and modifies code, creates files, and makes edits.',
    allowedTools: ['FileRead', 'FileEdit', 'FileWrite', 'Grep', 'Glob', 'Bash'],
    systemPrompt: `You are an implementer. Your role is to write and modify code based on clear specifications. Follow existing code conventions. Make minimal, focused changes. Summarize what you changed and why.`,
    defaultContextHints: { memory: true, workspaceFiles: true, summary: true, projectContext: true, conversationContext: true },
  },
  'test-runner': {
    type: 'test-runner',
    name: 'Test Runner',
    description: 'Runs tests, analyzes failures, and reports results.',
    allowedTools: ['Bash', 'FileRead', 'Grep', 'Glob'],
    systemPrompt: `You are a test runner. Your role is to run tests, analyze failures, and report results clearly. Include test output, pass/fail counts, and actionable information about failures.`,
    defaultContextHints: { memory: false, workspaceFiles: true, summary: false, projectContext: true, conversationContext: false },
  },
  'researcher': {
    type: 'researcher',
    name: 'Researcher',
    description: 'Searches external documentation, finds solutions, and gathers information.',
    allowedTools: ['WebSearch', 'WebFetch', 'FileRead', 'Grep', 'Glob'],
    systemPrompt: `You are a researcher. Your role is to search external documentation, find solutions to technical problems, and gather relevant information. Provide concise summaries with source references.`,
    defaultContextHints: { memory: true, workspaceFiles: false, summary: false, projectContext: true, conversationContext: false },
  },
};

export function getAgentDefinition(type: Exclude<AgentType, 'orchestrator'>): AgentDefinition {
  return agentDefinitions[type];
}
