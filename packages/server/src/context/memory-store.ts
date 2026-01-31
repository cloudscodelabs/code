import type { MemoryEntry, MemoryCategory, MemoryScope, MemorySearchResult, CreateMemoryInput, UpdateMemoryInput, TaskIntent } from '@cloudscode/shared';
import { generateId, nowUnix } from '@cloudscode/shared';
import { getDb } from '../db/database.js';
import { logger } from '../logger.js';

// Stop words: common English words + task-instruction verbs that pollute FTS queries
const STOP_WORDS = new Set([
  // Common English
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'must',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'about', 'between', 'through', 'after', 'before', 'above', 'below',
  'and', 'but', 'or', 'nor', 'not', 'so', 'if', 'then', 'than',
  'no', 'yes', 'all', 'any', 'some', 'each', 'every', 'both',
  'up', 'out', 'just', 'also', 'very', 'too', 'only',
  // Task-instruction verbs
  'fix', 'implement', 'analyze', 'analyse', 'review', 'check', 'update',
  'create', 'add', 'remove', 'delete', 'modify', 'change', 'refactor',
  'debug', 'test', 'write', 'read', 'find', 'search', 'look', 'make',
  'get', 'set', 'run', 'build', 'deploy', 'ensure', 'verify', 'validate',
  // Filler
  'please', 'help', 'want', 'like', 'try', 'use', 'using', 'how',
  'why', 'when', 'where', 'there', 'here',
]);

// Intent keyword patterns
const INTENT_PATTERNS: Record<TaskIntent, RegExp> = {
  'bug-fix': /\b(bug|fix|broken|error|crash|fail|issue|wrong|incorrect|regression|patch|hotfix|debug|exception|stack\s?trace)\b/i,
  'feature': /\b(feature|add|new|implement|create|introduce|support|enable|extend|integrate|endpoint|ui|ux|page|component)\b/i,
  'refactor': /\b(refactor|restructure|reorganize|clean\s?up|simplify|extract|rename|move|split|merge|consolidate|decouple|modularize|optimize|performance)\b/i,
  'analysis': /\b(analyze|analyse|explain|understand|investigate|explore|review|audit|inspect|assess|evaluate|document|describe|how\s+does|what\s+is|architecture|structure)\b/i,
  'general': /./,
};

// Category priority per intent — ordered from highest to lowest priority
const INTENT_CATEGORY_PRIORITY: Record<TaskIntent, MemoryCategory[]> = {
  'bug-fix': ['issue', 'fact', 'architecture', 'convention', 'decision'],
  'feature': ['architecture', 'convention', 'decision', 'fact', 'issue'],
  'refactor': ['architecture', 'convention', 'decision', 'fact', 'issue'],
  'analysis': ['architecture', 'fact', 'decision', 'convention', 'issue'],
  'general': ['fact', 'architecture', 'convention', 'decision', 'issue'],
};

export function detectTaskIntent(taskDescription: string): TaskIntent {
  // Check patterns in priority order (most specific first)
  const intents: TaskIntent[] = ['bug-fix', 'refactor', 'analysis', 'feature'];
  for (const intent of intents) {
    if (INTENT_PATTERNS[intent].test(taskDescription)) {
      return intent;
    }
  }
  return 'general';
}

class MemoryStore {
  create(workspaceId: string, input: CreateMemoryInput, sourceProjectId?: string): MemoryEntry {
    const db = getDb();
    const scope: MemoryScope = input.scope ?? 'workspace';
    const entry: MemoryEntry = {
      id: generateId(),
      workspaceId,
      category: input.category,
      key: input.key,
      content: input.content,
      sourceProjectId: sourceProjectId ?? null,
      scope,
      confidence: 1.0,
      useCount: 0,
      promotedTo: null,
      createdAt: nowUnix(),
      updatedAt: nowUnix(),
    };

    db.prepare(`
      INSERT INTO memory_entries (id, workspace_id, category, key, content, source_project_id, scope, confidence, use_count, promoted_to, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id, entry.workspaceId, entry.category, entry.key,
      entry.content, entry.sourceProjectId, entry.scope, entry.confidence,
      entry.useCount, entry.promotedTo, entry.createdAt, entry.updatedAt,
    );

    logger.info({ id: entry.id, category: entry.category, key: entry.key, scope: entry.scope }, 'Memory entry created');
    return entry;
  }

  get(id: string): MemoryEntry | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM memory_entries WHERE id = ?').get(id) as any;
    return row ? this.rowToEntry(row) : null;
  }

  update(id: string, input: UpdateMemoryInput): MemoryEntry | null {
    const db = getDb();
    const sets: string[] = ['updated_at = ?'];
    const values: any[] = [nowUnix()];

    if (input.category !== undefined) {
      sets.push('category = ?');
      values.push(input.category);
    }
    if (input.key !== undefined) {
      sets.push('key = ?');
      values.push(input.key);
    }
    if (input.content !== undefined) {
      sets.push('content = ?');
      values.push(input.content);
    }
    if (input.confidence !== undefined) {
      sets.push('confidence = ?');
      values.push(input.confidence);
    }
    if (input.scope !== undefined) {
      sets.push('scope = ?');
      values.push(input.scope);
    }

    values.push(id);
    db.prepare(`UPDATE memory_entries SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.get(id);
  }

  delete(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM memory_entries WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listByWorkspace(workspaceId: string, category?: MemoryCategory): MemoryEntry[] {
    const db = getDb();
    if (category) {
      return (db.prepare(
        'SELECT * FROM memory_entries WHERE workspace_id = ? AND category = ? ORDER BY updated_at DESC',
      ).all(workspaceId, category) as any[]).map(this.rowToEntry);
    }
    return (db.prepare(
      'SELECT * FROM memory_entries WHERE workspace_id = ? ORDER BY updated_at DESC',
    ).all(workspaceId) as any[]).map(this.rowToEntry);
  }

  listByProject(workspaceId: string, projectId: string, category?: MemoryCategory): MemoryEntry[] {
    const db = getDb();
    if (category) {
      return (db.prepare(
        `SELECT * FROM memory_entries
         WHERE workspace_id = ? AND category = ?
           AND (scope = 'workspace' OR (scope = 'project' AND source_project_id = ?))
         ORDER BY updated_at DESC`,
      ).all(workspaceId, category, projectId) as any[]).map(this.rowToEntry);
    }
    return (db.prepare(
      `SELECT * FROM memory_entries
       WHERE workspace_id = ?
         AND (scope = 'workspace' OR (scope = 'project' AND source_project_id = ?))
       ORDER BY updated_at DESC`,
    ).all(workspaceId, projectId) as any[]).map(this.rowToEntry);
  }

  search(workspaceId: string, queryText: string, limit: number = 10): MemorySearchResult[] {
    const db = getDb();

    const sanitized = this.buildSearchTerms(queryText);

    if (!sanitized) {
      return [];
    }

    // FTS5 search with bm25 ranking
    const rows = db.prepare(`
      SELECT me.*, bm25(memory_fts, 5.0, 1.0, 0.5) AS rank
      FROM memory_fts
      JOIN memory_entries me ON memory_fts.rowid = me.rowid
      WHERE memory_fts MATCH ? AND me.workspace_id = ?
      ORDER BY rank
      LIMIT ?
    `).all(sanitized, workspaceId, limit) as any[];

    // Increment use counts
    for (const row of rows) {
      db.prepare('UPDATE memory_entries SET use_count = use_count + 1 WHERE id = ?').run(row.id);
    }

    return rows.map((row) => ({
      entry: this.rowToEntry(row),
      rank: row.rank,
    }));
  }

  searchByProject(workspaceId: string, projectId: string, queryText: string, limit: number = 10): MemorySearchResult[] {
    const db = getDb();

    const sanitized = this.buildSearchTerms(queryText);

    if (!sanitized) {
      return [];
    }

    const rows = db.prepare(`
      SELECT me.*, bm25(memory_fts, 5.0, 1.0, 0.5) AS rank
      FROM memory_fts
      JOIN memory_entries me ON memory_fts.rowid = me.rowid
      WHERE memory_fts MATCH ? AND me.workspace_id = ?
        AND (me.scope = 'workspace' OR (me.scope = 'project' AND me.source_project_id = ?))
      ORDER BY rank
      LIMIT ?
    `).all(sanitized, workspaceId, projectId, limit) as any[];

    for (const row of rows) {
      db.prepare('UPDATE memory_entries SET use_count = use_count + 1 WHERE id = ?').run(row.id);
    }

    return rows.map((row) => ({
      entry: this.rowToEntry(row),
      rank: row.rank,
    }));
  }

  formatForContext(entries: MemoryEntry[]): string {
    if (entries.length === 0) return '';

    const grouped = new Map<string, MemoryEntry[]>();
    for (const entry of entries) {
      const group = grouped.get(entry.category) ?? [];
      group.push(entry);
      grouped.set(entry.category, group);
    }

    const parts: string[] = [];
    for (const [category, items] of grouped) {
      parts.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}`);
      for (const item of items) {
        parts.push(`- **${item.key}**: ${item.content}`);
      }
    }

    return parts.join('\n');
  }

  markPromoted(id: string, promotedTo: string): MemoryEntry | null {
    const db = getDb();
    db.prepare('UPDATE memory_entries SET promoted_to = ?, updated_at = ? WHERE id = ?')
      .run(promotedTo, nowUnix(), id);
    return this.get(id);
  }

  listPromotionCandidates(workspaceId: string, projectId?: string, limit: number = 20): MemoryEntry[] {
    const db = getDb();
    // High confidence, frequently used, not yet promoted entries in overlapping categories
    const overlappingCategories = ['convention', 'architecture', 'decision', 'fact', 'issue'];
    const placeholders = overlappingCategories.map(() => '?').join(', ');

    if (projectId) {
      return (db.prepare(`
        SELECT * FROM memory_entries
        WHERE workspace_id = ? AND promoted_to IS NULL
          AND category IN (${placeholders})
          AND (scope = 'workspace' OR (scope = 'project' AND source_project_id = ?))
        ORDER BY use_count DESC, confidence DESC, updated_at DESC
        LIMIT ?
      `).all(workspaceId, ...overlappingCategories, projectId, limit) as any[]).map(this.rowToEntry);
    }

    return (db.prepare(`
      SELECT * FROM memory_entries
      WHERE workspace_id = ? AND promoted_to IS NULL
        AND category IN (${placeholders})
      ORDER BY use_count DESC, confidence DESC, updated_at DESC
      LIMIT ?
    `).all(workspaceId, ...overlappingCategories, limit) as any[]).map(this.rowToEntry);
  }

  searchByProjectWithIntent(
    workspaceId: string,
    projectId: string,
    queryText: string,
    intent: TaskIntent,
    limit: number = 10,
  ): MemorySearchResult[] {
    const db = getDb();
    const sanitized = this.buildSearchTerms(queryText);

    // If no meaningful terms remain after stop-word filtering, use fallback
    if (!sanitized) {
      return this.fallbackByIntent(workspaceId, projectId, intent, limit);
    }

    // Build category boost CASE expression based on intent priority
    const priorities = INTENT_CATEGORY_PRIORITY[intent];
    // First category gets weight 4, second 3, third 2, fourth 1, fifth 0
    const caseParts = priorities.map((cat, i) => `WHEN me.category = '${cat}' THEN ${4 - i}`);
    const caseExpr = `CASE ${caseParts.join(' ')} ELSE 0 END`;

    const rows = db.prepare(`
      SELECT me.*, bm25(memory_fts, 5.0, 1.0, 0.5) AS rank,
             (${caseExpr}) AS category_boost
      FROM memory_fts
      JOIN memory_entries me ON memory_fts.rowid = me.rowid
      WHERE memory_fts MATCH ? AND me.workspace_id = ?
        AND (me.scope = 'workspace' OR (me.scope = 'project' AND me.source_project_id = ?))
      ORDER BY rank - (category_boost * 2.0)
      LIMIT ?
    `).all(sanitized, workspaceId, projectId, limit) as any[];

    // Increment use counts
    for (const row of rows) {
      db.prepare('UPDATE memory_entries SET use_count = use_count + 1 WHERE id = ?').run(row.id);
    }

    if (rows.length > 0) {
      return rows.map((row) => ({
        entry: this.rowToEntry(row),
        rank: row.rank,
      }));
    }

    // FTS5 matched nothing — use intent-aware fallback
    return this.fallbackByIntent(workspaceId, projectId, intent, limit);
  }

  private fallbackByIntent(
    workspaceId: string,
    projectId: string,
    intent: TaskIntent,
    limit: number,
  ): MemorySearchResult[] {
    const db = getDb();
    const priorities = INTENT_CATEGORY_PRIORITY[intent];
    const results: MemorySearchResult[] = [];

    // Allocate slots proportionally: ~40%, ~25%, ~15%, ~10%, ~10%
    const slotRatios = [0.4, 0.25, 0.15, 0.1, 0.1];

    for (let i = 0; i < priorities.length && results.length < limit; i++) {
      const category = priorities[i];
      const slotsForCategory = Math.max(1, Math.round(limit * slotRatios[i]));
      const remaining = limit - results.length;
      const take = Math.min(slotsForCategory, remaining);

      const rows = db.prepare(`
        SELECT * FROM memory_entries
        WHERE workspace_id = ? AND category = ?
          AND (scope = 'workspace' OR (scope = 'project' AND source_project_id = ?))
        ORDER BY use_count DESC, confidence DESC
        LIMIT ?
      `).all(workspaceId, category, projectId, take) as any[];

      for (const row of rows) {
        results.push({ entry: this.rowToEntry(row), rank: 0 });
      }
    }

    // Increment use counts for returned entries
    for (const r of results) {
      db.prepare('UPDATE memory_entries SET use_count = use_count + 1 WHERE id = ?').run(r.entry.id);
    }

    return results;
  }

  /**
   * Strips stop words and task-instruction verbs from the query,
   * sanitizes for FTS5, and caps at 12 meaningful tokens.
   */
  private buildSearchTerms(queryText: string): string {
    const tokens = queryText
      .toLowerCase()
      .replace(/[?*+\-"(){}[\]^~:\\/<>!@#$%&=|;,.'_]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
      .slice(0, 12);

    if (tokens.length === 0) {
      return '';
    }

    return tokens.map((t) => `"${t}"`).join(' OR ');
  }

  private rowToEntry(row: any): MemoryEntry {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      category: row.category as MemoryCategory,
      key: row.key,
      content: row.content,
      sourceProjectId: row.source_project_id,
      scope: (row.scope ?? 'workspace') as MemoryScope,
      confidence: row.confidence,
      useCount: row.use_count,
      promotedTo: row.promoted_to ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

let memoryStore: MemoryStore;

export function initMemoryStore(): MemoryStore {
  memoryStore = new MemoryStore();
  return memoryStore;
}

export function getMemoryStore(): MemoryStore {
  if (!memoryStore) {
    throw new Error('MemoryStore not initialized');
  }
  return memoryStore;
}
