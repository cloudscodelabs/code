import type { Plan, RollbackInfo } from '@cloudscode/shared';
import { execSync } from 'node:child_process';
import { getPlanManager } from '../plans/plan-manager.js';
import { broadcast } from '../ws.js';
import { logger } from '../logger.js';

export class RollbackManager {
  captureRollbackPoint(plan: Plan, cwd: string): void {
    try {
      const sha = execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();
      if (sha && plan.workflowMetadata) {
        plan.workflowMetadata.rollbackInfo = {
          enabled: true,
          gitCommitBefore: sha,
        };
        getPlanManager().updatePlan(plan.id, {
          workflowMetadata: plan.workflowMetadata,
        });
        logger.info({ planId: plan.id, sha }, 'Rollback point captured');
      }
    } catch (err) {
      logger.warn({ err, planId: plan.id }, 'Could not capture git SHA for rollback (not a git repo?)');
    }
  }

  rollback(plan: Plan, cwd: string): boolean {
    const rollbackInfo = plan.workflowMetadata?.rollbackInfo;
    if (!rollbackInfo?.gitCommitBefore) {
      logger.warn({ planId: plan.id }, 'No rollback point available');
      return false;
    }

    try {
      execSync(`git reset --hard ${rollbackInfo.gitCommitBefore}`, { cwd, encoding: 'utf8' });
      logger.info({ planId: plan.id, sha: rollbackInfo.gitCommitBefore }, 'Rolled back to checkpoint');

      // Reset all step statuses to pending
      for (const step of plan.steps) {
        step.status = 'pending';
      }
      plan.status = 'ready';
      const planManager = getPlanManager();
      planManager.updatePlan(plan.id, { steps: plan.steps, status: 'ready' });
      broadcast({ type: 'plan:updated', payload: plan });
      broadcast({
        type: 'workflow:rollback_completed',
        payload: { planId: plan.id, success: true },
      });

      return true;
    } catch (err) {
      logger.error({ err, planId: plan.id }, 'Git rollback failed');
      broadcast({
        type: 'workflow:rollback_completed',
        payload: { planId: plan.id, success: false },
      });
      return false;
    }
  }
}
