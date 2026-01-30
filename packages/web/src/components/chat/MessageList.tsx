import { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chat-store.js';
import { useAgentStore } from '../../stores/agent-store.js';
import { useSettingsStore } from '../../stores/settings-store.js';
import { StreamingText } from './StreamingText.js';
import { Markdown } from './Markdown.js';
import { User, Bot, Loader2 } from 'lucide-react';

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const error = useChatStore((s) => s.error);
  const agents = useAgentStore((s) => s.agents);
  const openAgentDetailPanel = useSettingsStore((s) => s.openAgentDetailPanel);
  const selectAgent = useAgentStore((s) => s.selectAgent);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Count running subagents for the indicator chip
  const runningAgents = Array.from(agents.values()).filter(
    (a) => a.type !== 'orchestrator' && a.status === 'running',
  );

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {messages.map((msg) => (
        <div key={msg.id} className="flex gap-3">
          <div className={`mt-1 shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
            msg.role === 'user' ? 'bg-zinc-700' : 'bg-blue-600'
          }`}>
            {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-zinc-500 mb-1">
              {msg.role === 'user' ? 'You' : 'Assistant'}
            </div>
            {msg.role === 'assistant' ? (
              <Markdown content={msg.content} />
            ) : (
              <div className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
                {msg.content}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Running agents indicator */}
      {runningAgents.length > 0 && (
        <button
          onClick={() => {
            if (runningAgents.length === 1) {
              selectAgent(runningAgents[0].id);
            } else {
              selectAgent(null);
            }
            openAgentDetailPanel();
          }}
          className="mx-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/70 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700/70 transition-colors"
        >
          <Loader2 size={12} className="animate-spin text-blue-400" />
          <span>
            {runningAgents.length} {runningAgents.length === 1 ? 'agent' : 'agents'} working...
          </span>
          <span className="text-zinc-500">View details</span>
        </button>
      )}

      {/* Streaming response */}
      {isStreaming && streamingContent && (
        <div className="flex gap-3">
          <div className="mt-1 shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-blue-600">
            <Bot size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-zinc-500 mb-1">Assistant</div>
            <StreamingText content={streamingContent} />
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mx-10 p-3 rounded-lg bg-red-950/50 border border-red-900 text-sm text-red-300">
          {error}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
