import { useAgentStore } from '../../stores/agent-store.js';
import { X, Clock, Loader2 } from 'lucide-react';

function formatJson(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ToolCallDetail() {
  const selectedToolCallId = useAgentStore((s) => s.selectedToolCallId);
  const toolCalls = useAgentStore((s) => s.toolCalls);
  const selectToolCall = useAgentStore((s) => s.selectToolCall);

  if (!selectedToolCallId) return null;

  const toolCall = toolCalls.get(selectedToolCallId);
  if (!toolCall) return null;

  const isRunning = toolCall.status === 'running';

  return (
    <div className="border-t border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{toolCall.toolName}</span>
          {toolCall.durationMs != null && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <Clock size={10} />
              {toolCall.durationMs >= 1000
                ? `${(toolCall.durationMs / 1000).toFixed(1)}s`
                : `${toolCall.durationMs}ms`}
            </span>
          )}
        </div>
        <button
          onClick={() => selectToolCall(null)}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <h4 className="text-xs font-medium text-zinc-500 uppercase mb-1">Input</h4>
          <pre className="text-xs text-zinc-400 bg-zinc-950 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap break-all">
            {formatJson(toolCall.input)}
          </pre>
        </div>

        {isRunning ? (
          <div className="flex items-center gap-2 text-xs text-blue-400">
            <Loader2 size={12} className="animate-spin" />
            Running...
          </div>
        ) : (
          <div>
            <h4 className="text-xs font-medium text-zinc-500 uppercase mb-1">Output</h4>
            <pre className="text-xs text-zinc-400 bg-zinc-950 rounded p-2 overflow-auto max-h-60 whitespace-pre-wrap break-all">
              {formatJson(toolCall.output) || '(empty)'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
