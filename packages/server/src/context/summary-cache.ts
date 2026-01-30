import type { ProjectSummary } from '@cloudscode/shared';
import { MAX_SUMMARY_LENGTH } from '@cloudscode/shared';
import { logger } from '../logger.js';

class SummaryCache {
  private summaries = new Map<string, ProjectSummary>();

  getSummary(projectId: string): string | null {
    const summary = this.summaries.get(projectId);
    if (!summary) return null;

    const parts: string[] = [];

    if (summary.objective) {
      parts.push(`Objective: ${summary.objective}`);
    }
    if (summary.completedSteps.length > 0) {
      parts.push(`Completed: ${summary.completedSteps.join('; ')}`);
    }
    if (summary.filesModified.length > 0) {
      parts.push(`Files modified: ${summary.filesModified.join(', ')}`);
    }
    if (summary.pendingIssues.length > 0) {
      parts.push(`Pending: ${summary.pendingIssues.join('; ')}`);
    }
    if (summary.keyDecisions.length > 0) {
      parts.push(`Decisions: ${summary.keyDecisions.join('; ')}`);
    }

    const result = parts.join('\n');
    return result.length > MAX_SUMMARY_LENGTH
      ? result.slice(0, MAX_SUMMARY_LENGTH - 3) + '...'
      : result;
  }

  getStructured(projectId: string): ProjectSummary | null {
    return this.summaries.get(projectId) ?? null;
  }

  updateFromResponse(projectId: string, userMessage: string, assistantResponse: string): void {
    const existing = this.summaries.get(projectId) ?? {
      objective: null,
      completedSteps: [],
      filesModified: [],
      pendingIssues: [],
      keyDecisions: [],
    };

    // Set objective from first user message if not set
    if (!existing.objective) {
      existing.objective = userMessage.length > 200
        ? userMessage.slice(0, 197) + '...'
        : userMessage;
    }

    // Extract file modifications from response
    const filePatterns = assistantResponse.match(/(?:created|modified|updated|wrote|edited)\s+[`"]?([^\s`"]+\.[a-zA-Z]+)[`"]?/gi);
    if (filePatterns) {
      for (const match of filePatterns) {
        const fileMatch = match.match(/([^\s`"]+\.[a-zA-Z]+)/);
        if (fileMatch && !existing.filesModified.includes(fileMatch[1])) {
          existing.filesModified.push(fileMatch[1]);
        }
      }
    }

    // Add a completed step summary (keep last 10)
    const stepSummary = userMessage.length > 100
      ? userMessage.slice(0, 97) + '...'
      : userMessage;
    existing.completedSteps.push(stepSummary);
    if (existing.completedSteps.length > 10) {
      existing.completedSteps = existing.completedSteps.slice(-10);
    }

    // Keep files list manageable
    if (existing.filesModified.length > 20) {
      existing.filesModified = existing.filesModified.slice(-20);
    }

    this.summaries.set(projectId, existing);
    logger.debug({ projectId }, 'Summary cache updated');
  }

  clear(projectId: string): void {
    this.summaries.delete(projectId);
  }
}

let summaryCache: SummaryCache;

export function getSummaryCache(): SummaryCache {
  if (!summaryCache) {
    summaryCache = new SummaryCache();
  }
  return summaryCache;
}
