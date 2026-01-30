import type { Workspace } from '@cloudscode/shared';
import { getDb } from '../db/database.js';
import { generateId, nowUnix } from '@cloudscode/shared';

export class WorkspaceStore {
  ensureWorkspace(name: string, rootPath: string): Workspace {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM workspaces WHERE root_path = ?').get(rootPath) as any;
    if (existing) {
      return this.rowToWorkspace(existing);
    }

    const workspace: Workspace = {
      id: generateId(),
      name,
      rootPath,
      config: null,
      createdAt: nowUnix(),
    };

    db.prepare('INSERT INTO workspaces (id, name, root_path, created_at) VALUES (?, ?, ?, ?)').run(
      workspace.id,
      workspace.name,
      workspace.rootPath,
      workspace.createdAt,
    );

    return workspace;
  }

  getWorkspace(id: string): Workspace | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as any;
    return row ? this.rowToWorkspace(row) : null;
  }

  getByRootPath(rootPath: string): Workspace | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM workspaces WHERE root_path = ?').get(rootPath) as any;
    return row ? this.rowToWorkspace(row) : null;
  }

  private rowToWorkspace(row: any): Workspace {
    return {
      id: row.id,
      name: row.name,
      rootPath: row.root_path,
      config: row.config ?? null,
      createdAt: row.created_at,
    };
  }
}
