import type { MemoryEntry, MemoryCategory } from '@cloudscode/shared';
import { useMemoryStore } from '../../stores/memory-store.js';
import { MemoryEntryCard } from './MemoryEntryCard.js';
import { MemoryEmptyState } from './MemoryEmptyState.js';

// Memory categories that overlap with project settings
const OVERLAPPING_CATEGORIES = new Set<MemoryCategory>([
  'convention', 'architecture', 'decision', 'fact', 'issue',
]);

interface MemoryEntryListProps {
  entries: MemoryEntry[];
  hasActiveProject: boolean;
  hasSettingsForCategory: (cat: MemoryCategory) => boolean;
  onPromote: (entryId: string) => void;
  onDelete: (entryId: string) => void;
}

export function MemoryEntryList({
  entries,
  hasActiveProject,
  hasSettingsForCategory,
  onPromote,
  onDelete,
}: MemoryEntryListProps) {
  const expandedEntryId = useMemoryStore((s) => s.expandedEntryId);
  const toggleExpandedEntry = useMemoryStore((s) => s.toggleExpandedEntry);
  const openEditor = useMemoryStore((s) => s.openEditor);
  const search = useMemoryStore((s) => s.search);
  const categoryFilter = useMemoryStore((s) => s.categoryFilter);

  if (entries.length === 0) {
    if (search) {
      return <MemoryEmptyState variant="no-results" />;
    }
    if (categoryFilter) {
      return (
        <MemoryEmptyState
          variant="no-category"
          category={categoryFilter}
          onAddEntry={() => openEditor()}
        />
      );
    }
    return <MemoryEmptyState variant="no-entries" onAddEntry={() => openEditor()} />;
  }

  return (
    <div className="space-y-2 p-4">
      {entries.map((entry) => (
        <MemoryEntryCard
          key={entry.id}
          entry={entry}
          expanded={expandedEntryId === entry.id}
          onToggle={() => toggleExpandedEntry(entry.id)}
          onEdit={() => openEditor(entry)}
          onDelete={() => onDelete(entry.id)}
          onPromote={
            !entry.promotedTo && OVERLAPPING_CATEGORIES.has(entry.category) && hasActiveProject
              ? () => onPromote(entry.id)
              : undefined
          }
          hasSettingsConflict={
            !entry.promotedTo &&
            OVERLAPPING_CATEGORIES.has(entry.category) &&
            hasSettingsForCategory(entry.category)
          }
        />
      ))}
    </div>
  );
}
