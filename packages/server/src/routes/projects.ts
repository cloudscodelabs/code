import { Router } from 'express';
import { getProjectManager } from '../projects/project-manager.js';
import { ProjectScanner } from '../projects/project-scanner.js';
import { getConfig } from '../config.js';
import type { ProjectMetadataCategory } from '@cloudscode/shared';

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
      const scanner = new ProjectScanner(config.PROJECT_ROOT);
      const metadata = await scanner.fullScan();
      res.json({ metadata });
    } catch (err) {
      res.status(500).json({ error: 'Scan failed' });
    }
  });

  router.post('/:id/scan/:category', async (req, res) => {
    try {
      const config = getConfig();
      const scanner = new ProjectScanner(config.PROJECT_ROOT);
      const metadata = await scanner.scanCategory(req.params.category);
      res.json({ metadata });
    } catch (err) {
      res.status(500).json({ error: 'Scan failed' });
    }
  });

  return router;
}
