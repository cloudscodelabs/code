import type { WorkflowTemplate, WorkflowTemplateInput } from '@cloudscode/shared';
import { generateId, nowUnix } from '@cloudscode/shared';
import { getDb } from '../db/database.js';
import { logger } from '../logger.js';
import { BUILTIN_TEMPLATES } from './builtin-templates.js';

class WorkflowTemplateStore {
  seedBuiltins(): void {
    const db = getDb();
    const now = nowUnix();
    const upsert = db.prepare(
      `INSERT INTO workflow_templates (id, project_id, name, description, category, steps, is_builtin, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         category = excluded.category,
         steps = excluded.steps,
         updated_at = excluded.updated_at`
    );

    const seedAll = db.transaction(() => {
      for (const template of BUILTIN_TEMPLATES) {
        upsert.run(
          template.id,
          template.name,
          template.description,
          template.category,
          JSON.stringify(template.steps),
          now,
          now,
        );
      }
    });

    seedAll();
    logger.info({ count: BUILTIN_TEMPLATES.length }, 'Built-in workflow templates seeded');
  }

  getTemplate(id: string): WorkflowTemplate | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM workflow_templates WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.rowToTemplate(row);
  }

  listTemplates(projectId: string | null): WorkflowTemplate[] {
    const db = getDb();
    // Return global (project_id IS NULL) + project-specific templates
    let rows: any[];
    if (projectId) {
      rows = db.prepare(
        'SELECT * FROM workflow_templates WHERE project_id IS NULL OR project_id = ? ORDER BY is_builtin DESC, name ASC'
      ).all(projectId) as any[];
    } else {
      rows = db.prepare(
        'SELECT * FROM workflow_templates WHERE project_id IS NULL ORDER BY name ASC'
      ).all() as any[];
    }
    return rows.map((row) => this.rowToTemplate(row));
  }

  createTemplate(projectId: string, input: WorkflowTemplateInput): WorkflowTemplate {
    const db = getDb();
    const id = generateId();
    const now = nowUnix();

    db.prepare(
      `INSERT INTO workflow_templates (id, project_id, name, description, category, steps, is_builtin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      id,
      projectId,
      input.name,
      input.description,
      input.category,
      JSON.stringify(input.steps),
      now,
      now,
    );

    logger.info({ templateId: id, projectId }, 'Custom workflow template created');

    return {
      id,
      projectId,
      name: input.name,
      description: input.description,
      category: input.category,
      steps: input.steps,
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  updateTemplate(id: string, input: Partial<WorkflowTemplateInput>): void {
    const db = getDb();
    const existing = this.getTemplate(id);
    if (!existing) throw new Error('Template not found');
    if (existing.isBuiltin) throw new Error('Cannot edit built-in templates');

    const sets: string[] = ['updated_at = ?'];
    const values: unknown[] = [nowUnix()];

    if (input.name !== undefined) {
      sets.push('name = ?');
      values.push(input.name);
    }
    if (input.description !== undefined) {
      sets.push('description = ?');
      values.push(input.description);
    }
    if (input.category !== undefined) {
      sets.push('category = ?');
      values.push(input.category);
    }
    if (input.steps !== undefined) {
      sets.push('steps = ?');
      values.push(JSON.stringify(input.steps));
    }

    values.push(id);
    db.prepare(`UPDATE workflow_templates SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    logger.info({ templateId: id }, 'Workflow template updated');
  }

  deleteTemplate(id: string): void {
    const db = getDb();
    const existing = this.getTemplate(id);
    if (!existing) throw new Error('Template not found');
    if (existing.isBuiltin) throw new Error('Cannot delete built-in templates');

    db.prepare('DELETE FROM workflow_templates WHERE id = ?').run(id);
    logger.info({ templateId: id }, 'Workflow template deleted');
  }

  private rowToTemplate(row: any): WorkflowTemplate {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      category: row.category,
      steps: JSON.parse(row.steps || '[]'),
      isBuiltin: row.is_builtin === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

let store: WorkflowTemplateStore;

export function initWorkflowTemplateStore(): WorkflowTemplateStore {
  store = new WorkflowTemplateStore();
  store.seedBuiltins();
  return store;
}

export function getWorkflowTemplateStore(): WorkflowTemplateStore {
  if (!store) {
    throw new Error('WorkflowTemplateStore not initialized');
  }
  return store;
}
