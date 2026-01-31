import { createSdkMcpServer, tool } from '@anthropic-ai/claude-code';
import { z } from 'zod';
import type { Project, ProjectMetadata, ProjectMetadataCategory } from '@cloudscode/shared';
import { getProjectManager } from '../projects/project-manager.js';
import { getMemoryStore } from '../context/memory-store.js';
import { broadcast } from '../ws.js';
import { logger } from '../logger.js';
import {
  createProjectDirectory,
  cloneRepository,
  validateExistingDirectory,
} from '../projects/directory-manager.js';
import { OVERLAPPING_SETTINGS_CATEGORIES, settingsCategoryToMemoryCategory } from './knowledge-dedup.js';

// ---------------------------------------------------------------------------
// Identifier fields used for smart-matching array items
// ---------------------------------------------------------------------------

const IDENTIFIER_FIELDS = ['name', 'key', 'rule', 'tool', 'framework', 'title', 'id', 'path'] as const;

function getIdentifier(item: unknown): string | null {
  if (typeof item !== 'object' || item === null) return null;
  for (const field of IDENTIFIER_FIELDS) {
    const val = (item as Record<string, unknown>)[field];
    if (typeof val === 'string') return val;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Category classification helpers
// ---------------------------------------------------------------------------

const ARRAY_CATEGORIES = new Set<ProjectMetadataCategory>([
  'goals', 'tags', 'techStack', 'designPatterns', 'apiEndpoints',
  'folderMappings', 'entryPoints', 'modules',
  'services', 'databases', 'messageQueues', 'caches', 'environments', 'ciCd', 'infraAsCode',
  'team', 'codeOwnership',
  'testing', 'linting', 'build', 'scripts',
  'roadmap',
  'namingConventions', 'codingStandards', 'errorHandling',
  'documentation', 'adrs',
  'keyDependencies', 'externalIntegrations',
  'performanceBudgets', 'monitoring', 'slas',
  'domainConcepts', 'userPersonas', 'businessRules',
  'runbooks',
  'migrations',
  'knownIssues', 'techDebt',
]);

const OBJECT_CATEGORIES = new Set<ProjectMetadataCategory>([
  'git', 'prProcess', 'logging', 'security', 'ai', 'release',
  'accessibility', 'i18n', 'featureFlags',
]);

// Everything else is a primitive: packageManager, monorepoTool, vision, architecturePattern

// ---------------------------------------------------------------------------
// Smart merge logic
// ---------------------------------------------------------------------------

function smartMerge(
  current: unknown,
  incoming: unknown,
  category: ProjectMetadataCategory,
): unknown {
  // Array categories
  if (ARRAY_CATEGORIES.has(category)) {
    const currentArr = Array.isArray(current) ? current : [];
    const incomingArr = Array.isArray(incoming) ? incoming : [incoming];

    // String arrays (tags) — deduplicate
    if (category === 'tags') {
      const set = new Set<string>(currentArr as string[]);
      for (const item of incomingArr) {
        if (typeof item === 'string') set.add(item);
      }
      return [...set];
    }

    // Object arrays — match by identifier field
    const result = [...currentArr];
    for (const incomingItem of incomingArr) {
      const incomingId = getIdentifier(incomingItem);
      if (incomingId) {
        const existingIdx = result.findIndex((r) => getIdentifier(r) === incomingId);
        if (existingIdx >= 0) {
          // Deep-merge the matching item
          result[existingIdx] = { ...result[existingIdx], ...incomingItem };
        } else {
          result.push(incomingItem);
        }
      } else {
        result.push(incomingItem);
      }
    }
    return result;
  }

  // Object categories — shallow merge
  if (OBJECT_CATEGORIES.has(category)) {
    if (typeof current === 'object' && current !== null && typeof incoming === 'object' && incoming !== null) {
      return { ...current, ...incoming };
    }
    return incoming;
  }

  // Primitive categories — direct replacement
  return incoming;
}

function smartRemove(
  current: unknown,
  toRemove: unknown,
  category: ProjectMetadataCategory,
): unknown {
  // Array categories
  if (ARRAY_CATEGORIES.has(category)) {
    const currentArr = Array.isArray(current) ? current : [];
    const removeItems = Array.isArray(toRemove) ? toRemove : [toRemove];

    // String arrays (tags)
    if (category === 'tags') {
      const removeSet = new Set(removeItems.filter((i): i is string => typeof i === 'string'));
      return currentArr.filter((item) => !removeSet.has(item));
    }

    // Object arrays — match by identifier
    const removeIds = new Set(removeItems.map(getIdentifier).filter(Boolean));
    return currentArr.filter((item) => {
      const id = getIdentifier(item);
      return !id || !removeIds.has(id);
    });
  }

  // Object categories — delete specified keys
  if (OBJECT_CATEGORIES.has(category)) {
    if (typeof current === 'object' && current !== null && typeof toRemove === 'object' && toRemove !== null) {
      const result = { ...current };
      for (const key of Object.keys(toRemove)) {
        delete (result as Record<string, unknown>)[key];
      }
      return result;
    }
    return null;
  }

  // Primitives — set to null
  return null;
}

// ---------------------------------------------------------------------------
// Broadcast helper
// ---------------------------------------------------------------------------

function broadcastSettingsUpdate(
  projectId: string,
  category: string | null,
  data: unknown,
  fullMetadata: ProjectMetadata,
  projectFields?: Partial<Pick<Project, 'title' | 'description' | 'purpose' | 'primaryLanguage' | 'architecturePattern' | 'directoryPath'>>,
): void {
  broadcast({
    type: 'project:settings_updated',
    payload: { projectId, category, data, fullMetadata, ...(projectFields ? { projectFields } : {}) },
  });
}

// ---------------------------------------------------------------------------
// MCP Server Factory
// ---------------------------------------------------------------------------

export function createProjectSettingsMcpServer(projectId: string) {
  return createSdkMcpServer({
    name: 'project-settings',
    tools: [
      // ----- Tool 1: get_project_settings -----
      tool(
        'get_project_settings',
        'Read current project settings/metadata. Omit category to get all settings, or provide a category name to get a specific section.',
        {
          category: z.string().optional().describe(
            'Metadata category to read (e.g. "techStack", "git", "services", "ai", "codingStandards"). Omit to get all.',
          ),
        },
        async ({ category }) => {
          try {
            const pm = getProjectManager();
            const data = category
              ? pm.getProjectMetadata(projectId, category as ProjectMetadataCategory)
              : pm.getProjectMetadata(projectId);

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify(data ?? null, null, 2),
              }],
            };
          } catch (err) {
            logger.error({ err, projectId }, 'get_project_settings failed');
            return {
              content: [{ type: 'text' as const, text: `Error reading settings: ${err}` }],
              isError: true,
            };
          }
        },
      ),

      // ----- Tool 2: update_project_settings -----
      tool(
        'update_project_settings',
        'Update a specific project metadata category. Supports smart merging (arrays matched by name/id), replacing, or removing items. After setup is completed, overlapping categories (codingStandards, designPatterns, errorHandling, namingConventions, knownIssues, adrs, domainConcepts) are redirected to memory entries instead.',
        {
          category: z.string().describe(
            'Metadata category to update (e.g. "techStack", "git", "services", "packageManager", "codingStandards", "tags", "ai", "testing", "linting", "logging", "security").',
          ),
          data: z.unknown().describe(
            'The data to merge/replace/remove. For arrays: provide items to add or update. For objects: provide fields to merge. For primitives: the new value.',
          ),
          merge_mode: z.enum(['merge', 'replace', 'remove']).default('merge').describe(
            'merge: smart-merge with existing data. replace: overwrite entirely. remove: remove matching items.',
          ),
        },
        async ({ category, data, merge_mode }) => {
          try {
            const pm = getProjectManager();
            const cat = category as ProjectMetadataCategory;
            const project = pm.getProject(projectId);

            // After setup is completed, redirect overlapping categories to memory
            if (project?.setupCompleted && OVERLAPPING_SETTINGS_CATEGORIES.has(cat)) {
              const memoryCategory = settingsCategoryToMemoryCategory(cat);
              if (memoryCategory) {
                const memoryStore = getMemoryStore();
                const key = `${category}: ${typeof data === 'object' ? JSON.stringify(data) : String(data)}`.slice(0, 100);
                const content = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
                const entry = memoryStore.create(
                  project.workspaceId,
                  {
                    category: memoryCategory,
                    key,
                    content: `[From settings update - ${category}] ${content}`,
                    scope: 'project',
                  },
                  projectId,
                );
                broadcast({ type: 'memory:updated', payload: { entry, action: 'created' } });

                return {
                  content: [{
                    type: 'text' as const,
                    text: `Setup is completed. The "${category}" category is now stable. Created a memory entry (${memoryCategory}) instead: "${key}". If this knowledge stabilizes, it can be promoted to settings.`,
                  }],
                };
              }
            }

            const currentMeta = pm.getProjectMetadata(projectId) as ProjectMetadata;
            const currentValue = currentMeta[cat];

            let newValue: unknown;
            switch (merge_mode) {
              case 'merge':
                newValue = smartMerge(currentValue, data, cat);
                break;
              case 'replace':
                // Ensure array categories always store arrays
                if (ARRAY_CATEGORIES.has(cat) && data != null && !Array.isArray(data)) {
                  newValue = [data];
                } else {
                  newValue = data;
                }
                break;
              case 'remove':
                newValue = smartRemove(currentValue, data, cat);
                break;
            }

            pm.updateProjectMetadata(projectId, cat, newValue);

            // Re-read full metadata after update
            const fullMetadata = pm.getProjectMetadata(projectId) as ProjectMetadata;
            broadcastSettingsUpdate(projectId, category, newValue, fullMetadata);

            return {
              content: [{
                type: 'text' as const,
                text: `Updated ${category} (${merge_mode}). New value: ${JSON.stringify(newValue, null, 2)}`,
              }],
            };
          } catch (err) {
            logger.error({ err, projectId, category }, 'update_project_settings failed');
            return {
              content: [{ type: 'text' as const, text: `Error updating settings: ${err}` }],
              isError: true,
            };
          }
        },
      ),

      // ----- Tool 3: set_project_info -----
      tool(
        'set_project_info',
        'Update top-level project fields like title, description, purpose, primary language, or architecture pattern.',
        {
          title: z.string().optional().describe('Project title/name'),
          description: z.string().optional().describe('Brief project description'),
          purpose: z.string().optional().describe('What the project is for'),
          primaryLanguage: z.string().optional().describe('Primary programming language (e.g. "TypeScript", "Python")'),
          architecturePattern: z.string().optional().describe(
            'Architecture pattern: monolith, microservices, serverless, modular_monolith, event_driven, layered, hexagonal, cqrs, other',
          ),
        },
        async (fields) => {
          try {
            const pm = getProjectManager();
            const updates: Record<string, unknown> = {};
            if (fields.title !== undefined) updates.title = fields.title;
            if (fields.description !== undefined) updates.description = fields.description;
            if (fields.purpose !== undefined) updates.purpose = fields.purpose;
            if (fields.primaryLanguage !== undefined) updates.primaryLanguage = fields.primaryLanguage;
            if (fields.architecturePattern !== undefined) updates.architecturePattern = fields.architecturePattern;

            if (Object.keys(updates).length === 0) {
              return {
                content: [{ type: 'text' as const, text: 'No fields provided to update.' }],
              };
            }

            pm.updateProject(projectId, updates);

            // Read full metadata for broadcast
            const fullMetadata = pm.getProjectMetadata(projectId) as ProjectMetadata;
            broadcastSettingsUpdate(projectId, null, updates, fullMetadata, updates as Partial<Pick<Project, 'title' | 'description' | 'purpose' | 'primaryLanguage' | 'architecturePattern' | 'directoryPath'>>);

            const updatedFields = Object.keys(updates).join(', ');
            return {
              content: [{
                type: 'text' as const,
                text: `Updated project info: ${updatedFields}`,
              }],
            };
          } catch (err) {
            logger.error({ err, projectId }, 'set_project_info failed');
            return {
              content: [{ type: 'text' as const, text: `Error updating project info: ${err}` }],
              isError: true,
            };
          }
        },
      ),

      // ----- Tool 4: setup_project_directory -----
      tool(
        'setup_project_directory',
        'Set up the project working directory. Can create a new directory, clone a git repository, or use an existing directory.',
        {
          mode: z.enum(['create', 'clone', 'existing']).describe(
            'How to set up the directory: "create" = new empty dir, "clone" = git clone a repo, "existing" = use an existing path',
          ),
          name: z.string().optional().describe('Directory name (for "create" and "clone" modes). Defaults to project title or repo name.'),
          repo_url: z.string().optional().describe('Git repository URL (required for "clone" mode)'),
          directory_path: z.string().optional().describe('Absolute or ~-relative path to existing directory (required for "existing" mode)'),
        },
        async ({ mode, name, repo_url, directory_path }) => {
          try {
            const pm = getProjectManager();
            let resultPath: string;

            switch (mode) {
              case 'create': {
                const dirName = name || 'project';
                resultPath = createProjectDirectory(dirName);
                break;
              }
              case 'clone': {
                if (!repo_url) {
                  return {
                    content: [{ type: 'text' as const, text: 'Error: repo_url is required for clone mode.' }],
                    isError: true,
                  };
                }
                resultPath = cloneRepository(repo_url, name);
                // Also update the repository URL on the project
                pm.updateProject(projectId, { repositoryUrl: repo_url });
                break;
              }
              case 'existing': {
                if (!directory_path) {
                  return {
                    content: [{ type: 'text' as const, text: 'Error: directory_path is required for existing mode.' }],
                    isError: true,
                  };
                }
                resultPath = validateExistingDirectory(directory_path);
                break;
              }
            }

            pm.setDirectoryPath(projectId, resultPath);

            // Broadcast so the frontend receives the directoryPath update
            const fullMetadata = pm.getProjectMetadata(projectId) as ProjectMetadata;
            broadcastSettingsUpdate(projectId, null, { directoryPath: resultPath }, fullMetadata, { directoryPath: resultPath });

            return {
              content: [{
                type: 'text' as const,
                text: `Project directory set to: ${resultPath}`,
              }],
            };
          } catch (err) {
            logger.error({ err, projectId, mode }, 'setup_project_directory failed');
            return {
              content: [{ type: 'text' as const, text: `Error setting up directory: ${err}` }],
              isError: true,
            };
          }
        },
      ),

      // ----- Tool 5: complete_project_setup -----
      tool(
        'complete_project_setup',
        'Mark the project setup as completed. Call this when all setup questions have been answered or the user wants to skip remaining setup.',
        {},
        async () => {
          try {
            const pm = getProjectManager();
            pm.markSetupCompleted(projectId);
            broadcast({
              type: 'project:setup_completed',
              payload: { projectId },
            });
            return {
              content: [{
                type: 'text' as const,
                text: 'Project setup completed.',
              }],
            };
          } catch (err) {
            logger.error({ err, projectId }, 'complete_project_setup failed');
            return {
              content: [{ type: 'text' as const, text: `Error completing setup: ${err}` }],
              isError: true,
            };
          }
        },
      ),
    ],
  });
}
