import { getDb } from './database.js';

class SettingsStore {
  get(key: string): string | null {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    const db = getDb();
    db.prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, unixepoch())
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(key, value);
  }

  delete(key: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    return result.changes > 0;
  }

  has(key: string): boolean {
    const db = getDb();
    const row = db.prepare('SELECT 1 FROM settings WHERE key = ?').get(key);
    return row !== undefined;
  }
}

let settingsStore: SettingsStore;

export function initSettingsStore(): SettingsStore {
  settingsStore = new SettingsStore();
  return settingsStore;
}

export function getSettingsStore(): SettingsStore {
  if (!settingsStore) {
    throw new Error('SettingsStore not initialized. Call initSettingsStore() first.');
  }
  return settingsStore;
}
