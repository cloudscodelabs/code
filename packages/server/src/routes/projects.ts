import { Router } from 'express';
import { getProjectManager } from '../projects/project-manager.js';
import { ProjectScanner } from '../projects/project-scanner.js';
import { getConfig } from '../config.js';
import { getMemoryStore } from '../context/memory-store.js';
import { broadcast } from '../ws.js';
import type { ProjectMetadata, ProjectMetadataCategory } from '@cloudscode/shared';
import { OVERLAPPING_SETTINGS_CATEGORIES, settingsCategoryToMemoryCategory } from '../agents/knowledge-dedup.js';

export function projectsRouter(): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId required' });
    }
    const projectManager = getProjectManager();
    const projects = projectManager.listProjects(workspaceId);
    res.json({ projects });
  });

  router.get('/:id', (req, res) => {
    const projectManager = getProjectManager();
    const project = projectManager.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  });

  router.post('/', (req, res) => {
    const { workspaceId, title } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId required' });
    }
    const projectManager = getProjectManager();
    const project = projectManager.createProject(workspaceId, title);
    res.status(201).json(project);
  });

  router.patch('/:id', (req, res) => {
    const projectManager = getProjectManager();
    projectManager.updateProject(req.params.id, req.body);
    const project = projectManager.getProject(req.params.id);
    res.json(project);
  });

  router.patch('/:id/metadata/:category', (req, res) => {
    const projectManager = getProjectManager();
    const category = req.params.category as ProjectMetadataCategory;
    projectManager.updateProjectMetadata(req.params.id, category, req.body);
    const metadata = projectManager.getProjectMetadata(req.params.id);
    res.json({ metadata });
  });

  router.delete('/:id', (req, res) => {
    const projectManager = getProjectManager();
    projectManager.deleteProject(req.params.id);
    res.json({ ok: true });
  });

  // Auto-discovery scan routes
  router.post('/:id/scan', async (req, res) => {
    try {
      const config = getConfig();
      const projectManager = getProjectManager();
      const project = projectManager.getProject(req.params.id);
      const scanner = new ProjectScanner(config.PROJECT_ROOT);
      const metadata = await scanner.fullScan();

      // After setup, route overlapping categories to memory instead of settings
      if (project?.setupCompleted) {
        const { settingsMetadata, memoryEntries } = partitionScanResults(metadata, project.workspaceId, project.id);
        // Create memory entries for overlapping results
        for (const entry of memoryEntries) {
          broadcast({ type: 'memory:updated', payload: { entry, action: 'created' } });
        }
        res.json({ metadata: settingsMetadata, memoryEntriesCreated: memoryEntries.length });
      } else {
        res.json({ metadata });
      }
    } catch (err) {
      res.status(500).json({ error: 'Scan failed' });
    }
  });

  router.post('/:id/scan/:category', async (req, res) => {
    try {
      const config = getConfig();
      const projectManager = getProjectManager();
      const project = projectManager.getProject(req.params.id);
      const scanner = new ProjectScanner(config.PROJECT_ROOT);
      const metadata = await scanner.scanCategory(req.params.category);

      // After setup, route overlapping categories to memory
      if (project?.setupCompleted) {
        const { settingsMetadata, memoryEntries } = partitionScanResults(metadata, project.workspaceId, project.id);
        for (const entry of memoryEntries) {
          broadcast({ type: 'memory:updated', payload: { entry, action: 'created' } });
        }
        res.json({ metadata: settingsMetadata, memoryEntriesCreated: memoryEntries.length });
      } else {
        res.json({ metadata });
      }
    } catch (err) {
      res.status(500).json({ error: 'Scan failed' });
    }
  });

  return router;
}

/**
 * Partition scan results: overlapping categories go to memory, the rest stay as settings metadata.
 */
function partitionScanResults(
  metadata: Partial<ProjectMetadata>,
  workspaceId: string,
  projectId: string,
): { settingsMetadata: Partial<ProjectMetadata>; memoryEntries: any[] } {
  const settingsMetadata: Partial<ProjectMetadata> = {};
  const memoryEntries: any[] = [];
  const memoryStore = getMemoryStore();

  for (const [key, value] of Object.entries(metadata)) {
    const cat = key as ProjectMetadataCategory;
    if (OVERLAPPING_SETTINGS_CATEGORIES.has(cat) && value != null) {
      // Route to memory instead of settings
      const memCategory = settingsCategoryToMemoryCategory(cat);
      if (memCategory) {
        const items = Array.isArray(value) ? value : [value];
        for (const item of items) {
          const obj = typeof item === 'object' && item !== null ? item as Record<string, unknown> : null;
          const entryKey = obj
            ? String(obj.name ?? obj.rule ?? obj.title ?? obj.term ?? obj.context ?? cat)
            : String(item);
          const content = typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item);
          const entry = memoryStore.create(
            workspaceId,
            {
              category: memCategory,
              key: `[Scan] ${entryKey}`.slice(0, 100),
              content: `[Auto-detected from scan - ${cat}] ${content}`,
              scope: 'project',
            },
            projectId,
          );
          memoryEntries.push(entry);
        }
      }
    } else {
      (settingsMetadata as any)[key] = value;
    }
  }

  return { settingsMetadata, memoryEntries };
}
