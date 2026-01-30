import fs from 'node:fs';
import path from 'node:path';
import { WORKSPACE_DIR, PROJECT_FILE, CONVENTIONS_FILE } from '@cloudscode/shared';
import { logger } from '../logger.js';

class WorkspaceFiles {
  private projectRoot: string = '';
  private projectMd: string | null = null;
  private conventionsMd: string | null = null;

  async init(projectRoot: string): Promise<void> {
    this.projectRoot = projectRoot;
    const wsDir = path.join(projectRoot, WORKSPACE_DIR);

    // Ensure .cloudscode directory exists
    fs.mkdirSync(wsDir, { recursive: true });

    // Load or generate PROJECT.md
    const projectPath = path.join(wsDir, PROJECT_FILE);
    if (fs.existsSync(projectPath)) {
      this.projectMd = fs.readFileSync(projectPath, 'utf-8');
      logger.info('Loaded existing PROJECT.md');
    } else {
      this.projectMd = await this.generateProjectMd(projectRoot);
      fs.writeFileSync(projectPath, this.projectMd, 'utf-8');
      logger.info('Generated PROJECT.md');
    }

    // Load CONVENTIONS.md if it exists
    const conventionsPath = path.join(wsDir, CONVENTIONS_FILE);
    if (fs.existsSync(conventionsPath)) {
      this.conventionsMd = fs.readFileSync(conventionsPath, 'utf-8');
      logger.info('Loaded existing CONVENTIONS.md');
    }
  }

  getContext(): string | null {
    const parts: string[] = [];

    if (this.projectMd) {
      parts.push(`### Project\n${this.projectMd}`);
    }
    if (this.conventionsMd) {
      parts.push(`### Conventions\n${this.conventionsMd}`);
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  getProjectMd(): string | null {
    return this.projectMd;
  }

  getConventionsMd(): string | null {
    return this.conventionsMd;
  }

  saveProjectMd(content: string): void {
    this.projectMd = content;
    const filePath = path.join(this.projectRoot, WORKSPACE_DIR, PROJECT_FILE);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  saveConventionsMd(content: string): void {
    this.conventionsMd = content;
    const filePath = path.join(this.projectRoot, WORKSPACE_DIR, CONVENTIONS_FILE);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  private async generateProjectMd(projectRoot: string): Promise<string> {
    const lines: string[] = ['# Project Context', ''];

    // Detect project name from package.json
    const pkgPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        lines.push(`**Name**: ${pkg.name ?? 'Unknown'}`);
        if (pkg.description) lines.push(`**Description**: ${pkg.description}`);
        lines.push('');
      } catch {
        // ignore parse errors
      }
    }

    // Detect key files/directories
    const entries = fs.readdirSync(projectRoot, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => e.name);
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name);

    if (dirs.length > 0) {
      lines.push(`**Directories**: ${dirs.join(', ')}`);
    }

    // Detect stack
    const stack: string[] = [];
    if (files.includes('package.json')) stack.push('Node.js');
    if (files.includes('tsconfig.json') || files.includes('tsconfig.base.json')) stack.push('TypeScript');
    if (files.includes('pnpm-workspace.yaml')) stack.push('pnpm monorepo');
    if (files.includes('turbo.json')) stack.push('Turborepo');
    if (dirs.includes('src')) stack.push('src/ layout');

    if (stack.length > 0) {
      lines.push(`**Stack**: ${stack.join(', ')}`);
    }

    lines.push('');
    lines.push('<!-- Edit this file to provide project-specific context to the AI -->');

    return lines.join('\n');
  }
}

let workspaceFiles: WorkspaceFiles;

export async function initWorkspaceFiles(projectRoot: string): Promise<WorkspaceFiles> {
  workspaceFiles = new WorkspaceFiles();
  await workspaceFiles.init(projectRoot);
  return workspaceFiles;
}

export function getWorkspaceFiles(): WorkspaceFiles {
  if (!workspaceFiles) {
    throw new Error('WorkspaceFiles not initialized');
  }
  return workspaceFiles;
}
