export interface ContextBudget {
  projectId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  costUsd: number;
  maxBudgetUsd: number | null;
  agentBreakdown: AgentTokenUsage[];
}

export interface AgentTokenUsage {
  agentId: string;
  agentType: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface TokenUsageUpdate {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}
