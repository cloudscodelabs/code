import type { MemoryEntry, MemoryCategory } from '@cloudscode/shared';
import { Folder, Globe } from 'lucide-react';

const categoryConfig: Record<MemoryCategory, { label: string; color: string; barColor: string }> = {
  architecture: { label: 'Architecture', color: 'text-purple-400', barColor: 'bg-purple-500' },
  convention: { label: 'Convention', color: 'text-blue-400', barColor: 'bg-blue-500' },
  decision: { label: 'Decision', color: 'text-green-400', barColor: 'bg-green-500' },
  fact: { label: 'Fact', color: 'text-yellow-400', barColor: 'bg-yellow-500' },
  issue: { label: 'Issue', color: 'text-red-400', barColor: 'bg-red-500' },
};

interface MemoryStatsBarProps {
  entries: MemoryEntry[];
}

export function MemoryStatsBar({ entries }: MemoryStatsBarProps) {
  const total = entries.length;
  const projectCount = entries.filter((e) => e.scope === 'project').length;
  const workspaceCount = entries.filter((e) => e.scope === 'workspace').length;

  const categoryCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-800 bg-zinc-900/50">
      {/* Total */}
      <div className="text-sm text-zinc-300 font-medium whitespace-nowrap">
        {total} {total === 1 ? 'entry' : 'entries'}
      </div>

      {/* Category bars */}
      <div className="flex-1 flex items-center gap-2">
        {total > 0 && (
          <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-zinc-800">
            {(Object.keys(categoryConfig) as MemoryCategory[]).map((cat) => {
              const count = categoryCounts[cat] || 0;
              if (count === 0) return null;
              const pct = (count / total) * 100;
              return (
                <div
                  key={cat}
                  className={`${categoryConfig[cat].barColor} transition-all duration-300`}
                  style={{ width: `${pct}%` }}
                  title={`${categoryConfig[cat].label}: ${count}`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Category mini-cards */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {(Object.keys(categoryConfig) as MemoryCategory[]).map((cat) => {
          const count = categoryCounts[cat] || 0;
          if (count === 0) return null;
          return (
            <span
              key={cat}
              className={`px-1.5 py-0.5 text-[10px] rounded ${categoryConfig[cat].color} bg-zinc-800`}
            >
              {count}
            </span>
          );
        })}
      </div>

      {/* Scope breakdown */}
      <div className="flex items-center gap-2 text-[10px] text-zinc-500 flex-shrink-0 border-l border-zinc-700 pl-3">
        <span className="flex items-center gap-1">
          <Folder size={10} />
          {projectCount}
        </span>
        <span className="flex items-center gap-1">
          <Globe size={10} />
          {workspaceCount}
        </span>
      </div>
    </div>
  );
}
