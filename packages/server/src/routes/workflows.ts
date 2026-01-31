import { Router } from 'express';
import { getWorkflowTemplateStore } from '../workflows/workflow-template-store.js';
import { getWorkflowManager } from '../workflows/workflow-manager.js';

export function workflowsRouter(): Router {
  const router = Router();

  // List templates (global + project-scoped)
  router.get('/templates', (req, res) => {
    const projectId = (req.query.projectId as string) || null;
    const store = getWorkflowTemplateStore();
    const templates = store.listTemplates(projectId);
    res.json({ templates });
  });

  // Get single template
  router.get('/templates/:id', (req, res) => {
    const store = getWorkflowTemplateStore();
    const template = store.getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  });

  // Create custom template
  router.post('/templates', (req, res) => {
    const { projectId, name, description, category, steps } = req.body;
    if (!projectId || !name) {
      return res.status(400).json({ error: 'projectId and name are required' });
    }
    try {
      const store = getWorkflowTemplateStore();
      const template = store.createTemplate(projectId, { name, description: description ?? '', category: category ?? 'development', steps: steps ?? [] });
      res.status(201).json(template);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update custom template
  router.patch('/templates/:id', (req, res) => {
    const { name, description, category, steps } = req.body;
    try {
      const store = getWorkflowTemplateStore();
      store.updateTemplate(req.params.id, { name, description, category, steps });
      const updated = store.getTemplate(req.params.id);
      res.json(updated);
    } catch (err: any) {
      const status = err.message.includes('built-in') ? 403 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  // Delete custom template
  router.delete('/templates/:id', (req, res) => {
    try {
      const store = getWorkflowTemplateStore();
      store.deleteTemplate(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      const status = err.message.includes('built-in') ? 403 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  // Create plan from template
  router.post('/create', (req, res) => {
    const { projectId, templateId, userMessage, customTitle } = req.body;
    if (!projectId || !templateId || !userMessage) {
      return res.status(400).json({ error: 'projectId, templateId, and userMessage are required' });
    }
    try {
      const manager = getWorkflowManager();
      const plan = manager.createFromTemplate(projectId, templateId, { userMessage, customTitle });
      res.status(201).json(plan);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
