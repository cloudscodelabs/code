import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { getSettingsStore } from '../db/settings-store.js';
import { logger } from '../logger.js';

const SETTINGS_KEY = 'projects_root_dir';

/**
 * Resolve `~` and relative paths to absolute paths.
 */
export function resolveDirectory(dirPath: string): string {
  if (dirPath.startsWith('~')) {
    dirPath = path.join(os.homedir(), dirPath.slice(1));
  }
  return path.resolve(dirPath);
}

/**
 * Read the configured projects root directory from settings.
 */
export function getProjectsRootDir(): string | null {
  return getSettingsStore().get(SETTINGS_KEY);
}

/**
 * Validate, resolve, create (if needed), and persist the projects root directory.
 */
export function setProjectsRootDir(dirPath: string): string {
  const resolved = resolveDirectory(dirPath);

  fs.mkdirSync(resolved, { recursive: true });

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolved}`);
  }

  getSettingsStore().set(SETTINGS_KEY, resolved);
  logger.info({ rootDir: resolved }, 'Projects root directory set');
  return resolved;
}

/**
 * Sanitize a project name into a valid directory name.
 */
function sanitizeDirName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'project';
}

/**
 * Create a new project subdirectory under the root.
 * Handles name collisions by appending a numeric suffix.
 */
export function createProjectDirectory(name: string): string {
  const rootDir = getProjectsRootDir();
  if (!rootDir) {
    throw new Error('Projects root directory not configured. Set it in Settings first.');
  }

  const baseName = sanitizeDirName(name);
  let dirName = baseName;
  let dirPath = path.join(rootDir, dirName);
  let counter = 1;

  while (fs.existsSync(dirPath)) {
    counter++;
    dirName = `${baseName}-${counter}`;
    dirPath = path.join(rootDir, dirName);
  }

  fs.mkdirSync(dirPath, { recursive: true });
  logger.info({ dirPath }, 'Created project directory');
  return dirPath;
}

/**
 * Clone a git repository into the projects root directory.
 * Returns the absolute path to the cloned directory.
 */
export function cloneRepository(repoUrl: string, name?: string): string {
  const rootDir = getProjectsRootDir();
  if (!rootDir) {
    throw new Error('Projects root directory not configured. Set it in Settings first.');
  }

  // Derive directory name from repo URL or provided name
  const dirName = name
    ? sanitizeDirName(name)
    : repoUrl.split('/').pop()?.replace(/\.git$/, '') || 'repo';

  let targetDir = path.join(rootDir, dirName);
  let counter = 1;
  while (fs.existsSync(targetDir)) {
    counter++;
    targetDir = path.join(rootDir, `${dirName}-${counter}`);
  }

  logger.info({ repoUrl, targetDir }, 'Cloning repository');

  execSync(`git clone ${JSON.stringify(repoUrl)} ${JSON.stringify(targetDir)}`, {
    cwd: rootDir,
    timeout: 120_000, // 2 minute timeout
    stdio: 'pipe',
  });

  logger.info({ targetDir }, 'Repository cloned');
  return targetDir;
}

/**
 * Validate that a path exists and is a directory.
 */
export function validateExistingDirectory(dirPath: string): string {
  const resolved = resolveDirectory(dirPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Directory does not exist: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${resolved}`);
  }

  return resolved;
}
