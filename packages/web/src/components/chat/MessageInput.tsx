import { useState, useRef, useCallback } from 'react';
import { Send, Square, ChevronDown } from 'lucide-react';
import { wsClient } from '../../lib/ws-client.js';
import { useChatStore } from '../../stores/chat-store.js';

const MODEL_OPTIONS = [
  { value: 'sonnet', label: 'Sonnet' },
  { value: 'opus', label: 'Opus' },
  { value: 'haiku', label: 'Haiku' },
] as const;

function getStoredModel(): string {
  try {
    return localStorage.getItem('cloudscode:model') ?? 'sonnet';
  } catch {
    return 'sonnet';
  }
}

function storeModel(model: string): void {
  try {
    localStorage.setItem('cloudscode:model', model);
  } catch {}
}

export function MessageInput() {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(getStoredModel);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const handleModelSelect = useCallback((model: string) => {
    setSelectedModel(model);
    storeModel(model);
    setModelMenuOpen(false);
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Add user message locally
    useChatStore.getState().addMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      agentId: 'local',
      timestamp: Date.now(),
    });

    // Send to server with selected model
    wsClient.send({
      type: 'chat:send',
      payload: { content: trimmed, model: selectedModel },
    });

    setInput('');
    useChatStore.getState().startStreaming();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, selectedModel]);

  const handleInterrupt = () => {
    wsClient.send({ type: 'chat:interrupt' });
    useChatStore.getState().finishStreaming();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming) {
        handleSend();
      }
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    }
  };

  return (
    <div className="border-t border-zinc-800 p-4">
      <div className="flex gap-2 items-end max-w-3xl mx-auto">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          rows={1}
          className="flex-1 bg-zinc-850 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500 transition-colors"
        />

        {/* Model selector */}
        <div className="relative" ref={modelMenuRef}>
          <button
            onClick={() => setModelMenuOpen((v) => !v)}
            className="flex items-center gap-1 px-3 py-3 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition-colors"
          >
            {MODEL_OPTIONS.find((m) => m.value === selectedModel)?.label ?? 'Sonnet'}
            <ChevronDown size={12} />
          </button>
          {modelMenuOpen && (
            <div className="absolute bottom-full mb-1 right-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50 min-w-[100px]">
              {MODEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleModelSelect(opt.value)}
                  className={`block w-full text-left px-3 py-2 text-xs transition-colors ${
                    selectedModel === opt.value
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {isStreaming ? (
          <button
            onClick={handleInterrupt}
            className="p-3 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:hover:bg-blue-600"
          >
            <Send size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
