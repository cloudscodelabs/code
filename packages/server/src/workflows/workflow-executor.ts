import type { WebSocket } from 'ws';
import type { Plan, PlanStep, Project, QualityGateResult } from '@cloudscode/shared';
import { getPlanManager } from '../plans/plan-manager.js';
import { broadcast } from '../ws.js';
import { logger } from '../logger.js';
import { validateStepOutput } from './step-validator.js';
import { RollbackManager } from './rollback-manager.js';

interface ExecutorOptions {
  cwd: string;
  handleNormalMode: (content: string, ws: WebSocket, project: Project, model: string) => Promise<void>;
}

export class WorkflowExecutor {
  private rollbackManager = new RollbackManager();

  async execute(plan: Plan, project: Project, ws: WebSocket, options: ExecutorOptions): Promise<void> {
    const planManager = getPlanManager();
    const metadata = plan.workflowMetadata!;
    const parallelGroups = metadata.parallelGroups ?? [plan.steps.map((s) => s.id)];

    // Capture rollback point
    if (metadata.rollbackInfo?.enabled) {
      this.rollbackManager.captureRollbackPoint(plan, options.cwd);
    }

    const stepMap = new Map(plan.steps.map((s) => [s.id, s]));
    const failedSteps = new Set<string>();
    let allSucceeded = true;

    try {
      for (const group of parallelGroups) {
        const stepsInGroup = group
          .map((id) => stepMap.get(id))
          .filter((s): s is PlanStep => s != null);

        // Skip steps whose dependencies failed
        const executableSteps = stepsInGroup.filter((step) => {
          const deps = step.dependencies ?? [];
          const hasFailedDep = deps.some((d) => failedSteps.has(d));
          if (hasFailedDep) {
            step.status = 'skipped';
            planManager.updatePlanStep(plan.id, step);
            broadcast({ type: 'plan:step_updated', payload: { planId: plan.id, step } });
            return false;
          }
          return step.status === 'pending';
        });

        if (executableSteps.length === 0) continue;

        // Execute steps in group — run in parallel if >1 step
        if (executableSteps.length === 1) {
          const success = await this.executeStep(executableSteps[0], plan, project, ws, options);
          if (!success) {
            failedSteps.add(executableSteps[0].id);
            allSucceeded = false;
          }
        } else {
          const results = await Promise.all(
            executableSteps.map((step) => this.executeStep(step, plan, project, ws, options))
          );
          for (let i = 0; i < results.length; i++) {
            if (!results[i]) {
              failedSteps.add(executableSteps[i].id);
              allSucceeded = false;
            }
          }
        }

        // Update checkpoint after each group
        const lastCompleted = executableSteps.find((s) => s.status === 'completed');
        if (lastCompleted && plan.workflowMetadata) {
          plan.workflowMetadata.checkpointStepId = lastCompleted.id;
          planManager.updatePlan(plan.id, { workflowMetadata: plan.workflowMetadata });
          broadcast({
            type: 'workflow:checkpoint',
            payload: { planId: plan.id, stepId: lastCompleted.id },
          });
        }

        // Stop if any required quality gate failed
        if (failedSteps.size > 0) {
          const failedStep = executableSteps.find((s) => failedSteps.has(s.id));
          if (failedStep?.qualityGate?.required) {
            logger.info({ planId: plan.id, stepId: failedStep.id }, 'Required quality gate failed, stopping workflow');
            break;
          }
        }
      }
    } catch (err) {
      logger.error({ err, planId: plan.id }, 'Workflow execution failed unexpectedly');
      allSucceeded = false;
    }

    // Final status
    const finalStatus = allSucceeded ? 'completed' : 'failed';
    plan.status = finalStatus;
    planManager.updatePlan(plan.id, { status: finalStatus });
    broadcast({ type: 'plan:updated', payload: plan });
  }

  private async executeStep(
    step: PlanStep,
    plan: Plan,
    project: Project,
    ws: WebSocket,
    options: ExecutorOptions,
  ): Promise<boolean> {
    const planManager = getPlanManager();

    step.status = 'in_progress';
    planManager.updatePlanStep(plan.id, step);
    broadcast({ type: 'plan:step_updated', payload: { planId: plan.id, step } });

    try {
      await options.handleNormalMode(
        `[Workflow Step ${step.id}] ${step.title}\n\n${step.description}`,
        ws,
        project,
        'sonnet',
      );

      // Basic step output validation
      const validation = validateStepOutput(step, step.resultSummary ?? 'completed');

      // Quality gate evaluation
      if (step.qualityGate) {
        const passed = validation.valid;
        const result: QualityGateResult = {
          stepId: step.id,
          passed,
          output: validation.issues.length > 0 ? validation.issues.join('; ') : 'All checks passed',
          timestamp: Date.now(),
        };

        // Store result in workflow metadata
        if (plan.workflowMetadata) {
          if (!plan.workflowMetadata.qualityGateResults) {
            plan.workflowMetadata.qualityGateResults = {};
          }
          plan.workflowMetadata.qualityGateResults[step.id] = result;
          planManager.updatePlan(plan.id, { workflowMetadata: plan.workflowMetadata });
        }

        broadcast({
          type: 'workflow:quality_gate',
          payload: { planId: plan.id, stepId: step.id, result },
        });

        if (!passed && step.qualityGate.required) {
          step.status = 'failed';
          step.resultSummary = `Quality gate failed: ${validation.issues.join('; ')}`;
          planManager.updatePlanStep(plan.id, step);
          broadcast({ type: 'plan:step_updated', payload: { planId: plan.id, step } });
          return false;
        }
      }

      step.status = 'completed';
      planManager.updatePlanStep(plan.id, step);
      broadcast({ type: 'plan:step_updated', payload: { planId: plan.id, step } });
      return true;
    } catch (err) {
      logger.error({ err, stepId: step.id }, 'Workflow step execution failed');
      step.status = 'failed';
      step.resultSummary = err instanceof Error ? err.message : 'Execution failed';
      planManager.updatePlanStep(plan.id, step);
      broadcast({ type: 'plan:step_updated', payload: { planId: plan.id, step } });
      return false;
    }
  }
}
