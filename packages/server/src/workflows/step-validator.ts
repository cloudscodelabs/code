import type { PlanStep } from '@cloudscode/shared';

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export function validateStepOutput(step: PlanStep, output: string): ValidationResult {
  const issues: string[] = [];

  // Basic: agent must produce output
  if (!output || output.trim().length === 0) {
    issues.push('Step produced no output');
    return { valid: false, issues };
  }

  // Agent-type-specific heuristics
  switch (step.agentType) {
    case 'implementer': {
      // Implementer should mention file changes
      const hasFileRef = /\b(created|modified|updated|wrote|edited|added|changed)\b/i.test(output)
        || /\.(ts|js|tsx|jsx|py|go|rs|java|css|html|json|yaml|yml|toml)\b/.test(output);
      if (!hasFileRef) {
        issues.push('Implementer output does not reference any file changes');
      }
      break;
    }
    case 'test-runner': {
      // Test runner should have test results
      const hasTestResult = /\b(pass|fail|error|test|spec|suite|assert)\b/i.test(output)
        || /\d+\s*(pass|fail|test)/i.test(output);
      if (!hasTestResult) {
        issues.push('Test runner output does not contain test results');
      }
      break;
    }
    case 'code-analyst':
    case 'researcher':
      // These are read-only, just need output content
      break;
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
