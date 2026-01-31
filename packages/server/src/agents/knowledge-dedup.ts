import type { MemoryCategory, MemoryEntry, ProjectMetadata, ProjectMetadataCategory } from '@cloudscode/shared';

// ---------------------------------------------------------------------------
// Overlap mapping between memory categories and settings categories
// ---------------------------------------------------------------------------

/**
 * Maps each memory category to the settings categories it overlaps with.
 */
export const OVERLAP_MAP: Record<MemoryCategory, (keyof ProjectMetadata)[]> = {
  convention: ['codingStandards', 'namingConventions', 'errorHandling'],
  architecture: ['designPatterns', 'architecturePattern'],
  decision: ['adrs'],
  fact: ['domainConcepts'],
  issue: ['knownIssues'],
};

/**
 * The set of settings categories that overlap with memory categories.
 * After setup is completed, these should not be directly mutated by agents.
 */
export const OVERLAPPING_SETTINGS_CATEGORIES = new Set<ProjectMetadataCategory>([
  'codingStandards',
  'namingConventions',
  'errorHandling',
  'designPatterns',
  'architecturePattern',
  'adrs',
  'domainConcepts',
  'knownIssues',
]);

/**
 * Reverse mapping: settings category → memory category.
 */
const SETTINGS_TO_MEMORY: Record<string, MemoryCategory> = {
  codingStandards: 'convention',
  namingConventions: 'convention',
  errorHandling: 'convention',
  designPatterns: 'architecture',
  architecturePattern: 'architecture',
  adrs: 'decision',
  domainConcepts: 'fact',
  knownIssues: 'issue',
};

/**
 * Get the memory category for a given settings category, or null if not overlapping.
 */
export function settingsCategoryToMemoryCategory(cat: ProjectMetadataCategory): MemoryCategory | null {
  return SETTINGS_TO_MEMORY[cat] ?? null;
}

/**
 * Get the overlapping settings categories for a given memory category.
 */
export function memoryToSettingsCategories(memCat: MemoryCategory): (keyof ProjectMetadata)[] {
  return OVERLAP_MAP[memCat] ?? [];
}

// ---------------------------------------------------------------------------
// Unified knowledge builder
// ---------------------------------------------------------------------------

/**
 * Check if a settings category has any meaningful data.
 */
function hasSettingsData(metadata: ProjectMetadata, settingsKey: keyof ProjectMetadata): boolean {
  const value = metadata[settingsKey];
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'string') return value.length > 0;
  return true;
}

/**
 * Check if any of the overlapping settings categories for a memory category have data.
 */
function hasOverlappingSettingsData(metadata: ProjectMetadata, memCategory: MemoryCategory): boolean {
  const settingsKeys = OVERLAP_MAP[memCategory];
  return settingsKeys.some((key) => hasSettingsData(metadata, key));
}

/**
 * Builds a unified, deduplicated knowledge context string combining both project settings
 * and memory entries. When memory contradicts settings, uses recency to decide precedence.
 *
 * @param settingsContext - The formatted project settings context string
 * @param memoryEntries - Memory entries relevant to the task
 * @param metadata - The full project metadata
 * @param projectUpdatedAt - Unix timestamp of the last project update
 * @returns A single unified context string
 */
export function buildUnifiedKnowledge(
  settingsContext: string | null,
  memoryEntries: MemoryEntry[],
  metadata: ProjectMetadata,
  projectUpdatedAt: number,
): string {
  const parts: string[] = [];

  // Always include non-overlapping settings context
  if (settingsContext) {
    parts.push(settingsContext);
  }

  // Process memory entries with dedup logic
  if (memoryEntries.length > 0) {
    const overlapping: MemoryEntry[] = [];
    const nonOverlapping: MemoryEntry[] = [];

    for (const entry of memoryEntries) {
      if (hasOverlappingSettingsData(metadata, entry.category)) {
        overlapping.push(entry);
      } else {
        nonOverlapping.push(entry);
      }
    }

    // Non-overlapping entries always pass through
    if (nonOverlapping.length > 0) {
      const grouped = groupByCategory(nonOverlapping);
      for (const [category, items] of grouped) {
        parts.push(`\n### ${capitalize(category)}`);
        for (const item of items) {
          parts.push(`- **${item.key}**: ${item.content}`);
        }
      }
    }

    // Overlapping entries: apply recency-based dedup
    if (overlapping.length > 0) {
      const newerEntries = overlapping.filter((e) => e.updatedAt > projectUpdatedAt);
      const olderEntries = overlapping.filter((e) => e.updatedAt <= projectUpdatedAt);

      // Newer entries: include with "Recent update" label
      if (newerEntries.length > 0) {
        parts.push('\n### Recent Updates');
        parts.push('*These memory entries are newer than the settled settings and may supersede them:*');
        for (const entry of newerEntries) {
          parts.push(`- **[${capitalize(entry.category)}] ${entry.key}**: ${entry.content}`);
        }
      }

      // Older entries in overlapping categories are excluded (settings is the settled version)
      // They are intentionally not included to avoid duplication.
      void olderEntries;
    }
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByCategory(entries: MemoryEntry[]): Map<string, MemoryEntry[]> {
  const grouped = new Map<string, MemoryEntry[]>();
  for (const entry of entries) {
    const group = grouped.get(entry.category) ?? [];
    group.push(entry);
    grouped.set(entry.category, group);
  }
  return grouped;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
