// Template identity
export type BuiltinTemplateId = 'add-api-endpoint' | 'fix-bug' | 'add-feature' | 'refactor-component';
export type WorkflowCategory = 'development' | 'maintenance' | 'testing' | 'documentation';

// Quality gates
export interface QualityGate {
  type: 'test-pass' | 'lint-pass' | 'build-pass' | 'custom';
  description: string;
  required: boolean;
}

export interface QualityGateResult {
  stepId: string;
  passed: boolean;
  output: string;
  timestamp: number;
}

// Template step (definition-time, not execution-time)
export interface WorkflowTemplateStep {
  id: string;
  title: string;
  description: string;
  agentType: 'code-analyst' | 'implementer' | 'test-runner' | 'researcher';
  estimatedComplexity: 'low' | 'medium' | 'high';
  dependencies: string[];
  qualityGate?: QualityGate;
}

// Persisted template
export interface WorkflowTemplate {
  id: string;                          // UUID for DB, or BuiltinTemplateId for globals
  projectId: string | null;            // null = global/built-in
  name: string;
  description: string;
  category: WorkflowCategory;
  steps: WorkflowTemplateStep[];
  isBuiltin: boolean;                  // true for shipped defaults
  createdAt: number;
  updatedAt: number;
}

// Input for creating/updating custom templates
export interface WorkflowTemplateInput {
  name: string;
  description: string;
  category: WorkflowCategory;
  steps: WorkflowTemplateStep[];
}

// Execution metadata stored on Plan
export interface WorkflowMetadata {
  templateId: string;                  // which template was used
  templateName: string;                // snapshot of name at creation time
  checkpointStepId?: string;           // last completed step for resume
  parallelGroups?: string[][];         // groups of step IDs that can run in parallel
  qualityGateResults?: Record<string, QualityGateResult>;
  rollbackInfo?: RollbackInfo;
}

export interface RollbackInfo {
  enabled: boolean;
  lastGoodStepId?: string;
  gitCommitBefore?: string;            // git SHA before workflow started
}

// Suggestion from intent detection
export interface WorkflowSuggestion {
  templateId: string;
  templateName: string;
  confidence: number;                  // 0.0 - 1.0
  reasoning: string;
}
