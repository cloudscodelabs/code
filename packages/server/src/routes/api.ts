import { Router } from 'express';
import { getProjectManager } from '../projects/project-manager.js';
import { getAgentManager } from '../agents/agent-manager.js';
import { getContextManager } from '../context/context-manager.js';
import { getWorkspaceFiles } from '../workspace/workspace-files.js';

export function apiRouter(): Router {
  const router = Router();

  router.get('/workspace', (_req, res) => {
    const projectManager = getProjectManager();
    const workspaceId = projectManager.getDefaultWorkspaceId();
    if (!workspaceId) {
      return res.status(404).json({ error: 'No workspace configured' });
    }
    res.json({ workspaceId });
  });

  // Backward compat: /api/project redirects to workspace
  router.get('/project', (_req, res) => {
    const projectManager = getProjectManager();
    const workspaceId = projectManager.getDefaultWorkspaceId();
    if (!workspaceId) {
      return res.status(404).json({ error: 'No project configured' });
    }
    res.json({ projectId: workspaceId });
  });

  router.get('/agents/:projectId', (req, res) => {
    const agentManager = getAgentManager();
    const tree = agentManager.getAgentTree(req.params.projectId);
    res.json({ tree });
  });

  router.get('/context/:projectId', (req, res) => {
    const contextManager = getContextManager();
    const budget = contextManager.getBudget(req.params.projectId);
    res.json(budget);
  });

  router.get('/workspace/project', (_req, res) => {
    const workspaceFiles = getWorkspaceFiles();
    res.json({ content: workspaceFiles.getProjectMd() });
  });

  router.put('/workspace/project', (req, res) => {
    const workspaceFiles = getWorkspaceFiles();
    workspaceFiles.saveProjectMd(req.body.content);
    res.json({ ok: true });
  });

  router.get('/workspace/conventions', (_req, res) => {
    const workspaceFiles = getWorkspaceFiles();
    res.json({ content: workspaceFiles.getConventionsMd() });
  });

  router.put('/workspace/conventions', (req, res) => {
    const workspaceFiles = getWorkspaceFiles();
    workspaceFiles.saveConventionsMd(req.body.content);
    res.json({ ok: true });
  });

  return router;
}
