import type {
  MemoryEntry,
  ProjectMetadata, ProjectMetadataCategory,
  CodingStandard, NamingConvention, DesignPattern, Adr, DomainConcept, KnownIssue,
} from '@cloudscode/shared';
import { generateId } from '@cloudscode/shared';
import { getProjectManager } from '../projects/project-manager.js';
import { getMemoryStore } from '../context/memory-store.js';
import { broadcast } from '../ws.js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Promotion mapping: memory category → settings category + converter
// ---------------------------------------------------------------------------

interface PromotionResult {
  category: ProjectMetadataCategory;
  data: unknown;
  label: string;
}

/**
 * Convert a memory entry to a structured settings entry.
 * Returns null if the conversion is not possible for this category.
 */
export function convertMemoryToSettings(entry: MemoryEntry): PromotionResult | null {
  switch (entry.category) {
    case 'convention':
      return convertConvention(entry);
    case 'architecture':
      return convertArchitecture(entry);
    case 'decision':
      return convertDecision(entry);
    case 'fact':
      return convertFact(entry);
    case 'issue':
      return convertIssue(entry);
    default:
      return null;
  }
}

function convertConvention(entry: MemoryEntry): PromotionResult {
  // Decide if it's a naming convention or coding standard based on content
  const contentLower = entry.content.toLowerCase();
  const isNaming = contentLower.includes('naming') || contentLower.includes('case')
    || contentLower.includes('camel') || contentLower.includes('pascal')
    || contentLower.includes('kebab') || contentLower.includes('snake');

  if (isNaming) {
    const convention: NamingConvention = {
      target: entry.key,
      pattern: entry.content,
    };
    return {
      category: 'namingConventions',
      data: convention,
      label: `Naming Convention: ${entry.key}`,
    };
  }

  const standard: CodingStandard = {
    rule: entry.key,
    description: entry.content,
  };
  return {
    category: 'codingStandards',
    data: standard,
    label: `Coding Standard: ${entry.key}`,
  };
}

function convertArchitecture(entry: MemoryEntry): PromotionResult {
  const pattern: DesignPattern = {
    name: entry.key,
    description: entry.content,
  };
  return {
    category: 'designPatterns',
    data: pattern,
    label: `Design Pattern: ${entry.key}`,
  };
}

function convertDecision(entry: MemoryEntry): PromotionResult {
  const adr: Adr = {
    id: generateId(),
    title: entry.key,
    status: 'accepted',
    date: new Date(entry.createdAt * 1000).toISOString().split('T')[0],
    context: `Extracted from memory entry: ${entry.key}`,
    decision: entry.content,
  };
  return {
    category: 'adrs',
    data: adr,
    label: `ADR: ${entry.key}`,
  };
}

function convertFact(entry: MemoryEntry): PromotionResult {
  const concept: DomainConcept = {
    term: entry.key,
    definition: entry.content,
  };
  return {
    category: 'domainConcepts',
    data: concept,
    label: `Domain Concept: ${entry.key}`,
  };
}

function convertIssue(entry: MemoryEntry): PromotionResult {
  const issue: KnownIssue = {
    title: entry.key,
    description: entry.content,
    severity: 'medium',
  };
  return {
    category: 'knownIssues',
    data: issue,
    label: `Known Issue: ${entry.key}`,
  };
}

// ---------------------------------------------------------------------------
// Promotion execution
// ---------------------------------------------------------------------------

export interface PromotionPreview {
  memoryEntry: MemoryEntry;
  result: PromotionResult;
  existingConflict: unknown | null;
}

/**
 * Preview what a promotion would look like without executing it.
 */
export function previewPromotion(entry: MemoryEntry, projectId: string): PromotionPreview | null {
  const result = convertMemoryToSettings(entry);
  if (!result) return null;

  const pm = getProjectManager();
  const metadata = pm.getProjectMetadata(projectId) as ProjectMetadata;
  const existingValue = metadata[result.category];

  // Check for conflicts in array categories
  let existingConflict: unknown | null = null;
  if (Array.isArray(existingValue) && typeof result.data === 'object' && result.data !== null) {
    const data = result.data as Record<string, unknown>;
    const identifiers = ['name', 'rule', 'title', 'term', 'target', 'id'];
    for (const idField of identifiers) {
      if (data[idField]) {
        const match = existingValue.find(
          (item: any) => item[idField] === data[idField],
        );
        if (match) {
          existingConflict = match;
          break;
        }
      }
    }
  }

  return {
    memoryEntry: entry,
    result,
    existingConflict,
  };
}

/**
 * Execute the promotion: write to settings and mark memory entry.
 */
export function executePromotion(entryId: string, projectId: string): {
  success: boolean;
  result?: PromotionResult;
  error?: string;
} {
  const memoryStore = getMemoryStore();
  const entry = memoryStore.get(entryId);
  if (!entry) {
    return { success: false, error: 'Memory entry not found' };
  }

  if (entry.promotedTo) {
    return { success: false, error: 'Entry already promoted' };
  }

  const result = convertMemoryToSettings(entry);
  if (!result) {
    return { success: false, error: 'Cannot convert this memory category to settings' };
  }

  const pm = getProjectManager();
  const metadata = pm.getProjectMetadata(projectId) as ProjectMetadata;
  const currentValue = metadata[result.category];

  // For array categories, append the new item
  if (Array.isArray(currentValue)) {
    const newArray = [...currentValue, result.data];
    pm.updateProjectMetadata(projectId, result.category, newArray);
  } else if (currentValue == null) {
    // Initialize as array with single item for array-like categories
    pm.updateProjectMetadata(projectId, result.category, [result.data]);
  } else {
    // Replace for non-array categories
    pm.updateProjectMetadata(projectId, result.category, result.data);
  }

  // Mark the memory entry as promoted
  const promotedTo = `${result.category}:${result.label}`;
  memoryStore.markPromoted(entryId, promotedTo);

  // Broadcast updates
  const fullMetadata = pm.getProjectMetadata(projectId) as ProjectMetadata;
  broadcast({
    type: 'project:settings_updated',
    payload: { projectId, category: result.category, data: fullMetadata[result.category], fullMetadata },
  });

  const updatedEntry = memoryStore.get(entryId);
  if (updatedEntry) {
    broadcast({ type: 'memory:updated', payload: { entry: updatedEntry, action: 'updated' } });
  }

  logger.info({ entryId, projectId, category: result.category, label: result.label }, 'Memory entry promoted to settings');

  return { success: true, result };
}
