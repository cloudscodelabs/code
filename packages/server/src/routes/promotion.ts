import { Router } from 'express';
import { getMemoryStore } from '../context/memory-store.js';
import { previewPromotion, executePromotion } from '../services/knowledge-promotion.js';

export function promotionRouter(): Router {
  const router = Router();

  /**
   * POST /api/memory/:id/promote
   * Promote a memory entry to project settings.
   * Body: { projectId: string, preview?: boolean }
   */
  router.post('/:id/promote', (req, res) => {
    const { projectId, preview } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId required' });
    }

    const memoryStore = getMemoryStore();
    const entry = memoryStore.get(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Memory entry not found' });
    }

    if (preview) {
      const previewResult = previewPromotion(entry, projectId);
      if (!previewResult) {
        return res.status(400).json({ error: 'Cannot promote this memory category' });
      }
      return res.json({
        preview: true,
        category: previewResult.result.category,
        label: previewResult.result.label,
        data: previewResult.result.data,
        existingConflict: previewResult.existingConflict,
      });
    }

    const result = executePromotion(req.params.id, projectId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      promoted: true,
      category: result.result!.category,
      label: result.result!.label,
    });
  });

  /**
   * GET /api/memory/suggestions?projectId=X
   * List memory entries that are good candidates for promotion.
   */
  router.get('/suggestions', (req, res) => {
    const projectId = req.query.projectId as string;
    const workspaceId = req.query.workspaceId as string;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId required' });
    }

    const memoryStore = getMemoryStore();
    const candidates = memoryStore.listPromotionCandidates(workspaceId, projectId || undefined);

    // Enrich with preview info if projectId provided
    if (projectId) {
      const suggestions = candidates.map((entry) => {
        const preview = previewPromotion(entry, projectId);
        return {
          entry,
          promotion: preview ? {
            category: preview.result.category,
            label: preview.result.label,
            hasConflict: preview.existingConflict != null,
          } : null,
        };
      }).filter((s) => s.promotion != null);

      return res.json({ suggestions });
    }

    res.json({ suggestions: candidates.map((entry) => ({ entry, promotion: null })) });
  });

  return router;
}
