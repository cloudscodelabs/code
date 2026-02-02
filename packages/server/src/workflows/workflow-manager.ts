import type { Plan, PlanStep, WorkflowMetadata, WorkflowTemplate, WorkflowTemplateStep } from '@cloudscode/shared';
import { generateId, nowUnix } from '@cloudscode/shared';
import { getPlanManager } from '../plans/plan-manager.js';
import { getWorkflowTemplateStore } from './workflow-template-store.js';
import { logger } from '../logger.js';

/**
 * BFS level-order grouping by dependency graph. Exported for reuse in
 * orchestrator's legacy plan execution path.
 *
 * Accepts any array of items with `id` and `dependencies` fields,
 * so it works with both WorkflowTemplateStep and PlanStep.
 */
export function computeParallelGroups(steps: Array<{ id: string; dependencies: string[] }>): string[][] {
  const stepIds = new Set(steps.map((s) => s.id));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const step of steps) {
    inDegree.set(step.id, 0);
    dependents.set(step.id, []);
  }

  for (const step of steps) {
    let deg = 0;
    for (const dep of step.dependencies) {
      if (stepIds.has(dep)) {
        deg++;
        dependents.get(dep)!.push(step.id);
      }
    }
    inDegree.set(step.id, deg);
  }

  const groups: string[][] = [];
  let queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);

  while (queue.length > 0) {
    groups.push([...queue]);
    const nextQueue: string[] = [];
    for (const id of queue) {
      for (const dep of dependents.get(id) ?? []) {
        const newDeg = (inDegree.get(dep) ?? 1) - 1;
        inDegree.set(dep, newDeg);
        if (newDeg === 0) {
          nextQueue.push(dep);
        }
      }
    }
    queue = nextQueue;
  }

  return groups;
}

class WorkflowManager {
  createFromTemplate(
    projectId: string,
    templateId: string,
    opts: { userMessage: string; customTitle?: string },
  ): Plan {
    const store = getWorkflowTemplateStore();
    const template = store.getTemplate(templateId);
    if (!template) {
      throw new Error(`Workflow template not found: ${templateId}`);
    }

    const planSteps: PlanStep[] = template.steps.map((ts: WorkflowTemplateStep) => ({
      id: ts.id,
      title: ts.title,
      description: `${ts.description}\n\nUser context: ${opts.userMessage}`,
      agentType: ts.agentType,
      status: 'pending' as const,
      dependencies: ts.dependencies,
      estimatedComplexity: ts.estimatedComplexity,
      qualityGate: ts.qualityGate,
    }));

    const parallelGroups = computeParallelGroups(template.steps);

    const workflowMetadata: WorkflowMetadata = {
      templateId: template.id,
      templateName: template.name,
      parallelGroups,
      qualityGateResults: {},
      rollbackInfo: { enabled: true },
    };

    const planManager = getPlanManager();
    const plan = planManager.createPlan({
      projectId,
      title: opts.customTitle ?? `${template.name}: ${opts.userMessage.slice(0, 80)}`,
      summary: template.description,
      steps: planSteps,
      status: 'ready',
      workflowMetadata,
    });

    logger.info({ planId: plan.id, templateId, projectId }, 'Plan created from workflow template');
    return plan;
  }

  getTemplatesForProject(projectId: string): WorkflowTemplate[] {
    return getWorkflowTemplateStore().listTemplates(projectId);
  }
}

let manager: WorkflowManager;

export function initWorkflowManager(): WorkflowManager {
  manager = new WorkflowManager();
  return manager;
}

export function getWorkflowManager(): WorkflowManager {
  if (!manager) {
    throw new Error('WorkflowManager not initialized');
  }
  return manager;
}
