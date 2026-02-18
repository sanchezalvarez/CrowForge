import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { PlusCircle, Send, Trash2, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { ScrollArea } from "../components/ui/scroll-area";
import { Card } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { cn } from "../lib/utils";

const API_BASE = "http://127.0.0.1:8000";

const MODE_LABELS: Record<string, string> = {
  general: "General",
  writing: "Writing",
  coding: "Coding",
  analysis: "Analysis",
  brainstorm: "Brainstorm",
};

interface ChatSession {
  id: number;
  title: string;
  mode: string;
  created_at: string;
}

interface ChatMessage {
  id: number;
  session_id: number;
  role: string;
  content: string;
  created_at: string;
}

export function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeMode, setActiveMode] = useState("general");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
      const s = sessions.find((s) => s.id === activeSessionId);
      if (s) setActiveMode(s.mode);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadSessions() {
    try {
      const res = await axios.get(`${API_BASE}/chat/sessions`);
      setSessions(res.data);
    } catch {
      // backend may be offline
    }
  }

  async function loadMessages(sessionId: number) {
    try {
      const res = await axios.get(`${API_BASE}/chat/session/${sessionId}`);
      setMessages(res.data.messages);
      // Sync mode from server
      if (res.data.session?.mode) {
        setActiveMode(res.data.session.mode);
      }
    } catch {
      setMessages([]);
    }
  }

  async function createSession() {
    try {
      const res = await axios.post(`${API_BASE}/chat/session`, { mode: "general" });
      const session: ChatSession = res.data;
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      setActiveMode(session.mode);
    } catch {
      // ignore
    }
  }

  async function deleteSession(id: number) {
    try {
      await axios.delete(`${API_BASE}/chat/session/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch {
      // ignore
    }
  }

  async function changeMode(mode: string) {
    if (!activeSessionId) return;
    setActiveMode(mode);
    try {
      const res = await axios.put(`${API_BASE}/chat/session/${activeSessionId}/mode`, { mode });
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, mode: res.data.mode } : s))
      );
    } catch {
      // revert on failure
      if (activeSession) setActiveMode(activeSession.mode);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !activeSessionId) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      session_id: activeSessionId,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      await axios.post(
        `${API_BASE}/chat/session/${activeSessionId}/message`,
        { content }
      );
      await loadMessages(activeSessionId);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          session_id: activeSessionId,
          role: "assistant",
          content: "(Failed to get response. Is the backend running?)",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="w-[220px] shrink-0 border-r bg-background flex flex-col">
        <div className="p-3 border-b">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={createSession}
          >
            <PlusCircle className="h-4 w-4 mr-1.5" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
                  activeSessionId === s.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setActiveSessionId(s.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{s.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(s.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No chats yet.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeSessionId ? (
          <>
            {/* Header with mode selector */}
            <div className="border-b px-4 py-2 flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Mode</span>
              <Select value={activeMode} onValueChange={changeMode}>
                <SelectTrigger className="w-[150px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <Card
                      className={cn(
                        "px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {msg.content}
                    </Card>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <Card className="px-4 py-2.5 bg-muted text-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </Card>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-4">
              <div className="max-w-3xl mx-auto flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                  className="min-h-[44px] max-h-[160px] resize-none"
                  rows={1}
                  disabled={sending}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  size="icon"
                  className="shrink-0 h-[44px] w-[44px]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-3 text-muted-foreground/40" />
            <p className="text-sm font-medium">No chat selected</p>
            <p className="text-xs mt-1">Create a new chat to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
