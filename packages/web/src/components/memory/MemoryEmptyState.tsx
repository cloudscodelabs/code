import { Brain, Search, Layers, FileCode, GitBranch, BookOpen, AlertTriangle } from 'lucide-react';
import type { MemoryCategory } from '@cloudscode/shared';

type EmptyVariant = 'no-entries' | 'no-results' | 'no-category';

interface MemoryEmptyStateProps {
  variant: EmptyVariant;
  category?: MemoryCategory | '';
  onAddEntry?: () => void;
}

const categoryDescriptions: Record<MemoryCategory, { icon: React.ReactNode; description: string }> = {
  architecture: {
    icon: <Layers size={32} className="text-purple-500/50" />,
    description: 'Architecture entries describe system structure, design patterns, and high-level decisions about how the codebase is organized.',
  },
  convention: {
    icon: <FileCode size={32} className="text-blue-500/50" />,
    description: 'Convention entries capture coding standards, naming patterns, and agreed-upon practices for the project.',
  },
  decision: {
    icon: <GitBranch size={32} className="text-green-500/50" />,
    description: 'Decision entries record architectural decisions, trade-offs considered, and rationale for choices made.',
  },
  fact: {
    icon: <BookOpen size={32} className="text-yellow-500/50" />,
    description: 'Fact entries store domain knowledge, key concepts, and important contextual information.',
  },
  issue: {
    icon: <AlertTriangle size={32} className="text-red-500/50" />,
    description: 'Issue entries track known bugs, technical debt, and areas that need attention or improvement.',
  },
};

export function MemoryEmptyState({ variant, category, onAddEntry }: MemoryEmptyStateProps) {
  if (variant === 'no-results') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Search size={32} className="text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-400 mb-1">No matching entries</p>
        <p className="text-xs text-zinc-600">Try different search terms or clear your filters.</p>
      </div>
    );
  }

  if (variant === 'no-category' && category && category in categoryDescriptions) {
    const cat = categoryDescriptions[category as MemoryCategory];
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        {cat.icon}
        <p className="text-sm text-zinc-400 mt-3 mb-2 capitalize">No {category} entries yet</p>
        <p className="text-xs text-zinc-600 max-w-sm">{cat.description}</p>
        {onAddEntry && (
          <button
            onClick={onAddEntry}
            className="mt-4 px-4 py-2 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            Add {category} entry
          </button>
        )}
      </div>
    );
  }

  // Default: no entries at all
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Brain size={36} className="text-zinc-600 mb-3" />
      <p className="text-sm text-zinc-400 mb-1">No knowledge entries yet</p>
      <p className="text-xs text-zinc-600 max-w-sm mb-4">
        The knowledge base stores facts, conventions, architecture decisions, and more.
        Entries are created automatically by agents or can be added manually.
      </p>
      {onAddEntry && (
        <button
          onClick={onAddEntry}
          className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          Add First Entry
        </button>
      )}
    </div>
  );
}
