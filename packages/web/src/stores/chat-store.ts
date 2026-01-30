import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agentId: string;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  error: string | null;

  addMessage: (message: ChatMessage) => void;
  loadMessages: (messages: ChatMessage[]) => void;
  appendToken: (token: string) => void;
  startStreaming: () => void;
  finishStreaming: () => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
}

let messageCounter = 0;

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  streamingContent: '',
  isStreaming: false,
  error: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  loadMessages: (messages) =>
    set({ messages, streamingContent: '', isStreaming: false, error: null }),

  appendToken: (token) =>
    set((state) => ({
      streamingContent: state.streamingContent + token,
    })),

  startStreaming: () =>
    set({ isStreaming: true, streamingContent: '', error: null }),

  finishStreaming: () =>
    set((state) => {
      // If we have streaming content, add it as a message
      if (state.streamingContent) {
        return {
          isStreaming: false,
          streamingContent: '',
          messages: [
            ...state.messages,
            {
              id: `stream-${++messageCounter}`,
              role: 'assistant' as const,
              content: state.streamingContent,
              agentId: 'orchestrator',
              timestamp: Date.now(),
            },
          ],
        };
      }
      return { isStreaming: false, streamingContent: '' };
    }),

  setError: (error) => set({ error, isStreaming: false }),

  clearMessages: () => set({ messages: [], streamingContent: '', isStreaming: false, error: null }),
}));
