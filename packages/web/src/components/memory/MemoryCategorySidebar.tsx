import { Folder, Globe, ArrowUpCircle } from 'lucide-react';
import type { MemoryEntry, MemoryCategory } from '@cloudscode/shared';
import { MEMORY_CATEGORIES } from '@cloudscode/shared';
import { useMemoryStore } from '../../stores/memory-store.js';

const categoryConfig: Record<MemoryCategory, { label: string; dotColor: string }> = {
  architecture: { label: 'Architecture', dotColor: 'bg-purple-400' },
  convention: { label: 'Convention', dotColor: 'bg-blue-400' },
  decision: { label: 'Decision', dotColor: 'bg-green-400' },
  fact: { label: 'Fact', dotColor: 'bg-yellow-400' },
  issue: { label: 'Issue', dotColor: 'bg-red-400' },
};

type ScopeFilter = 'all' | 'project' | 'workspace';

interface MemoryCategorySidebarProps {
  entries: MemoryEntry[];
  promotionCount: number;
}

export function MemoryCategorySidebar({ entries, promotionCount }: MemoryCategorySidebarProps) {
  const categoryFilter = useMemoryStore((s) => s.categoryFilter);
  const setCategoryFilter = useMemoryStore((s) => s.setCategoryFilter);
  const scopeFilter = useMemoryStore((s) => s.scopeFilter);
  const setScopeFilter = useMemoryStore((s) => s.setScopeFilter);

  const categoryCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});

  const totalCount = entries.length;

  return (
    <div className="w-48 border-r border-zinc-800 flex flex-col py-2 flex-shrink-0">
      {/* Categories */}
      <div className="px-3 mb-2">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Categories</div>
      </div>

      {/* All button */}
      <button
        onClick={() => setCategoryFilter('')}
        className={`mx-2 px-3 py-1.5 text-xs rounded text-left flex items-center gap-2 transition-colors ${
          !categoryFilter
            ? 'bg-zinc-800 text-zinc-200 border-l-2 border-blue-500'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border-l-2 border-transparent'
        }`}
      >
        <span className="flex-1">All</span>
        <span className="text-[10px] text-zinc-600">{totalCount}</span>
      </button>

      {/* Category buttons */}
      {MEMORY_CATEGORIES.map((cat) => {
        const config = categoryConfig[cat];
        const count = categoryCounts[cat] || 0;
        const isActive = categoryFilter === cat;

        return (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`mx-2 px-3 py-1.5 text-xs rounded text-left flex items-center gap-2 transition-colors ${
              isActive
                ? 'bg-zinc-800 text-zinc-200 border-l-2 border-blue-500'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 border-l-2 border-transparent'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${config.dotColor} flex-shrink-0`} />
            <span className="flex-1">{config.label}</span>
            <span className="text-[10px] text-zinc-600">{count}</span>
          </button>
        );
      })}

      {/* Divider */}
      <div className="mx-3 my-3 border-t border-zinc-800" />

      {/* Scope filter */}
      <div className="px-3 mb-2">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Scope</div>
      </div>

      {([
        { value: 'all' as ScopeFilter, label: 'All', icon: null },
        { value: 'project' as ScopeFilter, label: 'Project', icon: <Folder size={10} /> },
        { value: 'workspace' as ScopeFilter, label: 'Workspace', icon: <Globe size={10} /> },
      ]).map(({ value, label, icon }) => (
        <button
          key={value}
          onClick={() => setScopeFilter(value)}
          className={`mx-2 px-3 py-1.5 text-xs rounded text-left flex items-center gap-2 transition-colors ${
            scopeFilter === value
              ? 'bg-zinc-800 text-zinc-200'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          }`}
        >
          {icon}
          <span>{label}</span>
        </button>
      ))}

      {/* Divider */}
      <div className="mx-3 my-3 border-t border-zinc-800" />

      {/* Promotion candidates */}
      {promotionCount > 0 && (
        <div className="mx-2 px-3 py-2 rounded bg-blue-600/10 border border-blue-600/20">
          <div className="flex items-center gap-1.5 text-xs text-blue-400">
            <ArrowUpCircle size={12} />
            <span>Promotions</span>
            <span className="text-[10px] text-blue-500 ml-auto">{promotionCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
