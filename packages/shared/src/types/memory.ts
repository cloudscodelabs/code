export type MemoryCategory = 'architecture' | 'convention' | 'decision' | 'fact' | 'issue';

export interface MemoryEntry {
  id: string;
  workspaceId: string;
  category: MemoryCategory;
  key: string;
  content: string;
  sourceProjectId: string | null;
  confidence: number;
  useCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  rank: number;
}

export interface CreateMemoryInput {
  category: MemoryCategory;
  key: string;
  content: string;
}

export interface UpdateMemoryInput {
  category?: MemoryCategory;
  key?: string;
  content?: string;
  confidence?: number;
}
