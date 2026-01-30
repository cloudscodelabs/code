export const DEFAULT_PORT = 3000;
export const DEFAULT_WS_PATH = '/ws';

export const AGENT_TYPES = ['orchestrator', 'code-analyst', 'implementer', 'test-runner', 'researcher'] as const;

export const MEMORY_CATEGORIES = ['architecture', 'convention', 'decision', 'fact', 'issue'] as const;

export const PROJECT_STATUSES = ['active', 'paused', 'completed', 'archived', 'planning', 'maintenance', 'deprecated'] as const;

// Backward compatibility
export const SESSION_STATUSES = PROJECT_STATUSES;

// Token pricing (Claude Sonnet 4)
export const PRICING = {
  inputPerMillion: 3.0,
  outputPerMillion: 15.0,
  cacheReadPerMillion: 0.30,
  cacheWritePerMillion: 3.75,
} as const;

export const MAX_MEMORY_INJECTION_ENTRIES = 10;
export const MAX_SUMMARY_LENGTH = 2000;

export const MAX_ROUTING_HISTORY_MESSAGES = 20;
export const MAX_ROUTING_MESSAGE_LENGTH = 300;

export const WORKSPACE_DIR = '.cloudscode';
export const PROJECT_FILE = 'PROJECT.md';
export const CONVENTIONS_FILE = 'CONVENTIONS.md';
