import { ChevronRight, ChevronDown, Folder, Globe, CheckCircle, Shield, ArrowUpCircle, Pencil, Trash2 } from 'lucide-react';
import type { MemoryEntry, MemoryCategory } from '@cloudscode/shared';

const categoryColors: Record<MemoryCategory, string> = {
  architecture: 'text-purple-400 bg-purple-400/10',
  convention: 'text-blue-400 bg-blue-400/10',
  decision: 'text-green-400 bg-green-400/10',
  fact: 'text-yellow-400 bg-yellow-400/10',
  issue: 'text-red-400 bg-red-400/10',
};

const scopeColors: Record<string, string> = {
  project: 'text-cyan-400 bg-cyan-400/10',
  workspace: 'text-orange-400 bg-orange-400/10',
};

const confidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'bg-green-500';
  if (confidence >= 0.5) return 'bg-yellow-500';
  return 'bg-red-500';
};

interface MemoryEntryCardProps {
  entry: MemoryEntry;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPromote?: () => void;
  hasSettingsConflict?: boolean;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MemoryEntryCard({
  entry,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onPromote,
  hasSettingsConflict,
}: MemoryEntryCardProps) {
  return (
    <div className="rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
      {/* Collapsed header (always visible) */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 text-left"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-zinc-500 flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-zinc-500 flex-shrink-0" />
        )}

        {/* Badges */}
        <span className={`px-1.5 py-0.5 text-[10px] rounded capitalize flex-shrink-0 ${categoryColors[entry.category]}`}>
          {entry.category}
        </span>
        <span className={`px-1.5 py-0.5 text-[10px] rounded flex items-center gap-0.5 flex-shrink-0 ${scopeColors[entry.scope]}`}>
          {entry.scope === 'project' ? <Folder size={8} /> : <Globe size={8} />}
          {entry.scope === 'project' ? 'Project' : 'Shared'}
        </span>
        {entry.promotedTo && (
          <span className="px-1.5 py-0.5 text-[10px] rounded flex items-center gap-0.5 text-green-400 bg-green-400/10 flex-shrink-0">
            <CheckCircle size={8} />
            Promoted
          </span>
        )}
        {!entry.promotedTo && hasSettingsConflict && (
          <span className="px-1.5 py-0.5 text-[10px] rounded flex items-center gap-0.5 text-zinc-500 bg-zinc-700/30 flex-shrink-0">
            <Shield size={8} />
            Settled
          </span>
        )}

        {/* Key */}
        <span className="text-xs font-medium text-zinc-300 truncate flex-1 min-w-0">
          {entry.key}
        </span>

        {/* Mini confidence bar */}
        {entry.confidence < 1 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-8 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${confidenceColor(entry.confidence)}`}
                style={{ width: `${entry.confidence * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Usage count */}
        {entry.useCount > 0 && (
          <span className="text-[10px] text-zinc-600 flex-shrink-0">
            {entry.useCount}x
          </span>
        )}
      </button>

      {/* Collapsed content preview */}
      {!expanded && (
        <div className="px-3 pb-3 -mt-1">
          <p className="text-xs text-zinc-500 line-clamp-2 pl-6">{entry.content}</p>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-zinc-800/50 mt-0 pt-3 space-y-3">
          {/* Full content */}
          <p className="text-xs text-zinc-400 leading-relaxed pl-6 whitespace-pre-wrap">{entry.content}</p>

          {/* Confidence bar */}
          <div className="pl-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-16">Confidence</span>
              <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden max-w-48">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${confidenceColor(entry.confidence)}`}
                  style={{ width: `${entry.confidence * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-400 w-8 text-right">
                {(entry.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Timestamps */}
          <div className="pl-6 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-600">
            <span>Created: {formatDate(entry.createdAt)}</span>
            <span>Updated: {formatDate(entry.updatedAt)}</span>
            {entry.useCount > 0 && <span>Used {entry.useCount} time{entry.useCount !== 1 ? 's' : ''}</span>}
            {entry.sourceProjectId && <span>Source: {entry.sourceProjectId.slice(0, 8)}</span>}
          </div>

          {entry.promotedTo && (
            <div className="pl-6 text-[10px] text-green-600">
              Promoted to: {entry.promotedTo}
            </div>
          )}

          {/* Actions */}
          <div className="pl-6 flex items-center gap-2 pt-1">
            {!entry.promotedTo && onPromote && (
              <button
                onClick={(e) => { e.stopPropagation(); onPromote(); }}
                className="flex items-center gap-1 px-2 py-1 text-[10px] text-blue-400 bg-blue-400/10 rounded hover:bg-blue-400/20 transition-colors"
              >
                <ArrowUpCircle size={10} />
                Promote
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-400 bg-zinc-800 rounded hover:bg-zinc-700 transition-colors"
            >
              <Pencil size={10} />
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-red-400 bg-red-400/10 rounded hover:bg-red-400/20 transition-colors"
            >
              <Trash2 size={10} />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
