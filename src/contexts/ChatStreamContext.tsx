import { createContext, useContext, useRef, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { useFetchSSE } from "../hooks/useFetchSSE";
import type { AgentEvent } from "../hooks/useFetchSSE";

const API_BASE = "http://127.0.0.1:8000";

export interface AgentScope {
  sheet_ids?: string[];
  document_ids?: string[];
}

interface SendMessageParams {
  sessionId: number;
  content: string;
  temperature?: number;
  maxTokens?: number;
  isAgent?: boolean;
  scope?: AgentScope;
}

interface ChatStreamContextValue {
  streamingSessionId: number | null;
  streamingContent: string;
  isStreaming: boolean;
  isSending: boolean;
  sendMessage: (params: SendMessageParams) => void;
  stopStreaming: () => void;
  onStreamDone: React.MutableRefObject<(() => void) | null>;
  onStreamError: React.MutableRefObject<((error: string) => void) | null>;
  agentEvents: AgentEvent[];
  clearAgentEvents: () => void;
}

const ChatStreamContext = createContext<ChatStreamContextValue | null>(null);

export function ChatStreamProvider({ children }: { children: ReactNode }) {
  const [streamingSessionId, setStreamingSessionId] = useState<number | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const sendingRef = useRef(false);

  const { start: startSSE, cancel: cancelSSE } = useFetchSSE();

  const onStreamDone = useRef<(() => void) | null>(null);
  const onStreamError = useRef<((error: string) => void) | null>(null);

  const sendMessage = useCallback(
    (params: SendMessageParams) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      setIsSending(true);
      setIsStreaming(false);
      setStreamingContent("");
      setAgentEvents([]);
      setStreamingSessionId(params.sessionId);

      const endpoint = params.isAgent
        ? `${API_BASE}/chat/session/${params.sessionId}/agent/stream`
        : `${API_BASE}/chat/session/${params.sessionId}/message/stream`;

      startSSE(
        endpoint,
        { content: params.content, temperature: params.temperature, max_tokens: params.maxTokens, ...(params.scope ? { scope: params.scope } : {}) },
        {
          onToken: (token) => {
            setIsStreaming(true);
            setStreamingContent((prev) => prev + token);
          },
          onDone: () => {
            setStreamingContent("");
            setIsStreaming(false);
            setIsSending(false);
            setStreamingSessionId(null);
            sendingRef.current = false;
            onStreamDone.current?.();
          },
          onError: (error) => {
            setStreamingContent("");
            setIsStreaming(false);
            setIsSending(false);
            setStreamingSessionId(null);
            sendingRef.current = false;
            onStreamError.current?.(error);
          },
          onStructuredEvent: (event) => {
            setAgentEvents((prev) => [...prev, event]);
          },
        }
      );
    },
    [startSSE]
  );

  const stopStreaming = useCallback(() => {
    cancelSSE();
    setStreamingContent("");
    setIsStreaming(false);
    setIsSending(false);
    setStreamingSessionId(null);
    sendingRef.current = false;
  }, [cancelSSE]);

  const clearAgentEvents = useCallback(() => setAgentEvents([]), []);

  return (
    <ChatStreamContext.Provider
      value={{
        streamingSessionId,
        streamingContent,
        isStreaming,
        isSending,
        sendMessage,
        stopStreaming,
        onStreamDone,
        onStreamError,
        agentEvents,
        clearAgentEvents,
      }}
    >
      {children}
    </ChatStreamContext.Provider>
  );
}

export function useChatStream(): ChatStreamContextValue {
  const ctx = useContext(ChatStreamContext);
  if (!ctx) throw new Error("useChatStream must be used within ChatStreamProvider");
  return ctx;
}
