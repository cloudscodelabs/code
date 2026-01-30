import { Router } from 'express';
import { spawn } from 'node:child_process';
import type { ProjectMetadataCategory } from '@cloudscode/shared';
import { getAuthStatus, clearOAuthCredentials } from '../auth/api-key-provider.js';
import { getProjectSettingsService } from '../services/project-settings.js';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import { getProjectsRootDir, setProjectsRootDir } from '../projects/directory-manager.js';

export function settingsRouter(): Router {
  const router = Router();

  // GET /api/settings/auth/status
  router.get('/auth/status', (_req, res) => {
    const status = getAuthStatus();
    res.json(status);
  });

  // POST /api/settings/auth/login — spawns `claude login` to open browser OAuth flow
  router.post('/auth/login', (_req, res) => {
    const status = getAuthStatus();
    if (status.authenticated) {
      res.json({ started: false, reason: 'Already authenticated' });
      return;
    }

    try {
      const child = spawn('npx', ['@anthropic-ai/claude-code', 'login'], {
        stdio: 'ignore',
        detached: true,
        shell: true,
      });

      child.unref();

      logger.info({ pid: child.pid }, 'Spawned claude login process');
      res.json({ started: true });
    } catch (err) {
      logger.error({ err }, 'Failed to spawn claude login');
      res.status(500).json({ error: 'Failed to start login process' });
    }
  });

  // POST /api/settings/auth/logout — clears stored OAuth credentials
  router.post('/auth/logout', (_req, res) => {
    const cleared = clearOAuthCredentials();
    const status = getAuthStatus();
    res.json({ cleared, ...status });
  });

  // GET /api/settings/projects-root — get the configured projects root directory
  router.get('/projects-root', (_req, res) => {
    const projectsRootDir = getProjectsRootDir();
    res.json({ projectsRootDir });
  });

  // PUT /api/settings/projects-root — set the projects root directory
  router.put('/projects-root', (req, res) => {
    try {
      const { rootDir } = req.body;
      if (!rootDir || typeof rootDir !== 'string') {
        res.status(400).json({ error: 'rootDir is required' });
        return;
      }
      setProjectsRootDir(rootDir);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, 'Failed to set projects root dir');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to set root directory' });
    }
  });

  return router;
}
