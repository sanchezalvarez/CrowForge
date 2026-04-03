import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, MessageSquare, Loader2, FileText,
  Paperclip, X, Check, Info, Upload, Square,
  Wrench, ChevronDown, ChevronRight, Link2,
} from "lucide-react";
import type { AgentEvent } from "../hooks/useFetchSSE";
import { useChatStream } from "../contexts/ChatStreamContext";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { cn } from "../lib/utils";
import { getAPIBase } from "../lib/api";
import { toast } from "../hooks/useToast";
import { useIsDark } from "../hooks/useIsDark";
import { useSidebarResize } from "../hooks/useSidebarResize";
import { createMarkdownComponents } from "../lib/markdownComponents";
import { SessionSidebar } from "../components/SessionSidebar";
import { RisoBackground } from "../components/RisoBackground";
import type { DocumentContext } from "../App";
import type { TuningParams } from "../components/AIControlPanel";
import type { ChatSession, ChatMessage, AttachedFile, TipTapNode } from "../types/api";
import agentCrowner from "../assets/AgentCrowner_512.png";

const CTX_SENTINEL = "\n\n[/CONTEXT]\n\n";

const MODE_LABELS: Record<string, string> = {
  general: "General",
  writing: "Writing",
  coding: "Coding",
  analysis: "Analysis",
  brainstorm: "Brainstorm",
};

const MODE_DESCRIPTIONS: Record<string, string> = {
  general: "A helpful AI assistant for everyday questions and tasks.",
  writing: "Drafts, edits, and improves written content with focus on tone and clarity.",
  coding: "Expert programming help — write, debug, and understand code.",
  analysis: "Breaks down problems, interprets data, and draws conclusions with rigorous reasoning.",
  brainstorm: "Creative ideation partner — generates ideas and explores possibilities.",
};

// 12 predefined user avatars — cute animals
const USER_AVATARS = [
  { emoji: "🐱", label: "Cat" },
  { emoji: "🐶", label: "Dog" },
  { emoji: "🐰", label: "Rabbit" },
  { emoji: "🦜", label: "Parrot" },
  { emoji: "🐟", label: "Fish" },
  { emoji: "🦊", label: "Fox" },
  { emoji: "🐢", label: "Turtle" },
  { emoji: "🐸", label: "Frog" },
  { emoji: "🐼", label: "Panda" },
  { emoji: "🦋", label: "Butterfly" },
  { emoji: "🐧", label: "Penguin" },
  { emoji: "🦔", label: "Hedgehog" },
];

interface ChatPageProps {
  documentContext?: DocumentContext | null;
  onDisconnectDoc?: () => void;
  onConnectDoc?: (ctx: DocumentContext) => void;
  tuningParams?: TuningParams;
  initialSessionId?: string | null;
}

/** Renders the agent's "thought process": thinking text, tool calls with start/finish/timing. */
function ToolCallBubble({ events }: { events: AgentEvent[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (events.length === 0) return null;

  // Build a display-order list of steps
  type ThinkingStep = { kind: "thinking"; content: string };
  type ToolStep = { kind: "tool"; callId: string; tool: string; args: Record<string, unknown>; result?: string; durationMs?: number; finished: boolean };
  type Step = ThinkingStep | ToolStep;

  const steps: Step[] = [];
  const toolMap = new Map<string, ToolStep>();

  for (const evt of events) {
    if (evt.type === "thinking") {
      steps.push({ kind: "thinking", content: evt.content ?? "" });
    } else if (evt.type === "started_tool") {
      const step: ToolStep = {
        kind: "tool",
        callId: evt.call_id ?? `t${steps.length}`,
        tool: evt.tool ?? "unknown",
        args: evt.args ?? {},
        finished: false,
      };
      steps.push(step);
      toolMap.set(step.callId, step);
    } else if (evt.type === "finished_tool") {
      const existing = toolMap.get(evt.call_id ?? "");
      if (existing) {
        existing.result = evt.result;
        existing.durationMs = evt.duration_ms;
        existing.finished = true;
      }
    }
  }

  return (
    <div className="space-y-1.5 mb-2">
      {steps.map((step, i) => {
        if (step.kind === "thinking") {
          return (
            <div key={`t${i}`} className="text-xs text-muted-foreground italic px-1 py-0.5">
              {step.content}
            </div>
          );
        }
        const key = step.callId;
        const isOpen = expanded[key] ?? false;
        return (
          <div key={key} className="border rounded-md bg-muted/50 text-xs">
            <button
              className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left hover:bg-muted/80 transition-colors"
              onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
            >
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Wrench className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{step.tool}</span>
              {step.finished ? (
                <span className="ml-auto flex items-center gap-1.5">
                  {step.durationMs != null && (
                    <span className="text-muted-foreground">{step.durationMs}ms</span>
                  )}
                  <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                </span>
              ) : (
                <Loader2 className="h-3 w-3 animate-spin ml-auto text-muted-foreground" />
              )}
            </button>
            {isOpen && (
              <div className="px-2.5 pb-2 space-y-1 border-t">
                {Object.keys(step.args).length > 0 && (
                  <div className="mt-1.5">
                    <span className="text-muted-foreground">Args: </span>
                    <code className="text-[10px]">{JSON.stringify(step.args)}</code>
                  </div>
                )}
                {step.result && (
                  <div>
                    <span className="text-muted-foreground">Result: </span>
                    <code className="text-[10px] break-all">{
                      step.result.length > 500
                        ? step.result.slice(0, 500) + "..."
                        : step.result
                    }</code>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ChatPage({ documentContext, onDisconnectDoc, onConnectDoc, tuningParams, initialSessionId }: ChatPageProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(initialSessionId ? parseInt(initialSessionId) : null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeMode, setActiveMode] = useState("general");

  // Sync with prop changes
  useEffect(() => {
    if (initialSessionId) setActiveSessionId(parseInt(initialSessionId));
  }, [initialSessionId]);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [renamingSessionId, setRenamingSessionId] = useState<number | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [docList, setDocList] = useState<{ id: string; title: string }[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const docPickerRef = useRef<HTMLDivElement>(null);
  const [sessionMenu, setSessionMenu] = useState<{ sessionId: number; x: number; y: number } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const { sidebarWidth, onResizeStart } = useSidebarResize();

  const {
    streamingSessionId, streamingContent, isStreaming, isSending,
    sendMessage: contextSendMessage, stopStreaming, onStreamDone, onStreamError,
    agentEvents,
  } = useChatStream();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const isDark = useIsDark();
  const avatarIndex = parseInt(localStorage.getItem("user_avatar_index") ?? "0", 10);
  const userAvatar = USER_AVATARS[avatarIndex] ?? USER_AVATARS[0];

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    function onAvatarChange() { forceUpdate(n => n + 1); }
    window.addEventListener("avatarchange", onAvatarChange);
    window.addEventListener("storage", onAvatarChange);
    return () => {
      window.removeEventListener("avatarchange", onAvatarChange);
      window.removeEventListener("storage", onAvatarChange);
    };
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  useEffect(() => { loadSessions(); }, []);

  useEffect(() => {
    function onDataDeleted(e: Event) {
      const target = (e as CustomEvent).detail?.target;
      if (target === "chat" || target === "all") {
        setSessions([]);
        setActiveSessionId(null);
        setMessages([]);
        loadSessions();
      }
    }
    window.addEventListener("crowforge:data-deleted", onDataDeleted);
    return () => window.removeEventListener("crowforge:data-deleted", onDataDeleted);
  }, []);

  useEffect(() => {
    axios.get(`${getAPIBase()}/documents`).then(r => {
      const docs = Array.isArray(r.data) ? r.data : r.data.documents ?? [];
      setDocList(docs);
    }).catch(() => { setDocList([]); });
  }, []);

  // Derive sending state: context is sending AND it's for our active session
  const sending = isSending && streamingSessionId === activeSessionId;

  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
      const s = sessions.find((s) => s.id === activeSessionId);
      if (s) setActiveMode(s.mode);
    } else {
      setMessages([]);
    }
  }, [activeSessionId, sessions]);

  // Register stream callbacks — reload messages/sessions when stream completes
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  const handleStreamDone = useCallback(async () => {
    const sid = activeSessionIdRef.current;
    if (sid) await loadMessages(sid);
    await loadSessions();
  }, []);

  const handleStreamError = useCallback((error: string) => {
    const sid = activeSessionIdRef.current;
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + 1,
        session_id: sid ?? 0,
        role: "assistant",
        content: `(Error: ${error})`,
        created_at: new Date().toISOString(),
      },
    ]);
  }, []);

  useEffect(() => {
    onStreamDone.current = handleStreamDone;
    onStreamError.current = handleStreamError;
    return () => {
      onStreamDone.current = null;
      onStreamError.current = null;
    };
  }, [handleStreamDone, handleStreamError]);

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  // Close doc picker on outside click
  useEffect(() => {
    if (!showDocPicker) return;
    function onClickOutside(e: MouseEvent) {
      if (docPickerRef.current && !docPickerRef.current.contains(e.target as Node)) {
        setShowDocPicker(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showDocPicker]);

  async function loadSessions() {
    try {
      const res = await axios.get(`${getAPIBase()}/chat/sessions`);
      setSessions((res.data as ChatSession[]).filter(s => s.mode !== "agent"));
    } catch { /* backend may be offline */ }
  }

  async function loadMessages(sessionId: number) {
    try {
      const res = await axios.get(`${getAPIBase()}/chat/session/${sessionId}`);
      setMessages(res.data.messages);
      if (res.data.session?.mode) setActiveMode(res.data.session.mode);
    } catch { setMessages([]); }
  }

  async function createSession() {
    try {
      const res = await axios.post(`${getAPIBase()}/chat/session`, { mode: "general" });
      const session: ChatSession = res.data;
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      setActiveMode(session.mode);
    } catch {
      toast("Failed to create chat session.", "error");
    }
  }

  async function deleteSession(id: number) {
    try {
      await axios.delete(`${getAPIBase()}/chat/session/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); }
    } catch {
      toast("Failed to delete chat session.", "error");
    }
  }

  async function changeMode(mode: string) {
    if (!activeSessionId) return;
    setActiveMode(mode);
    try {
      const res = await axios.put(`${getAPIBase()}/chat/session/${activeSessionId}/mode`, { mode });
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, mode: res.data.mode } : s))
      );
    } catch {
      if (activeSession) setActiveMode(activeSession.mode);
    }
  }

  async function saveTitle(sessionId: number, title: string) {
    const t = title.trim();
    if (!t) return;
    try {
      await axios.put(`${getAPIBase()}/chat/session/${sessionId}/title`, { title: t });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: t } : s))
      );
    } catch {
      toast("Failed to save title.", "error");
    }
  }

  function startEditTitle() {
    if (!activeSession) return;
    setTitleInput(activeSession.title);
    setEditingTitle(true);
  }

  function commitTitle() {
    setEditingTitle(false);
    if (activeSessionId && titleInput.trim()) saveTitle(activeSessionId, titleInput);
  }

  function startRenameSession(id: number, currentTitle: string) {
    setRenamingSessionId(id);
    setRenameInput(currentTitle);
  }

  function commitRename() {
    if (renamingSessionId && renameInput.trim()) saveTitle(renamingSessionId, renameInput);
    setRenamingSessionId(null);
  }

  async function handleFileSelect(file: File) {
    if (!file.name.endsWith(".pdf")) return;
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await axios.post(`${getAPIBase()}/chat/upload`, form);
      setAttachedFile({ name: res.data.filename, text: res.data.text });
    } catch {
      toast("Failed to upload file.", "error");
    }
    setUploadingFile(false);
  }

  /** Strip the context prefix that was prepended before sending to AI.
   *  The prefix always ends with \n\n before the actual user text.
   *  Returns { text, hasContext, docTitle } */
  function parseUserMessage(content: string): { text: string; hasContext: boolean; docTitle: string | null; pdfName: string | null; docPreview: string | null } {
    // New format: sentinel-separated
    const sentinelIdx = content.indexOf(CTX_SENTINEL);
    if (sentinelIdx !== -1) {
      const prefix = content.slice(0, sentinelIdx);
      const text = content.slice(sentinelIdx + CTX_SENTINEL.length);
      const docMatch = prefix.match(/\[Active Document: "([^"]+)"/);
      const pdfMatch = prefix.match(/\[Attached PDF: ([^\]]+)\]/);
      const bodyMatch = prefix.match(/\[Document Content:\n([\s\S]*?)\]$/m);
      const docPreview = bodyMatch ? bodyMatch[1].split("\n").slice(0, 3).join("\n") : null;
      return { text, hasContext: true, docTitle: docMatch?.[1] ?? null, pdfName: pdfMatch?.[1] ?? null, docPreview };
    }
    // Legacy format: find first [bracket] block
    if (!content.startsWith("[")) return { text: content, hasContext: false, docTitle: null, pdfName: null, docPreview: null };
    const sep = content.indexOf("\n\n");
    if (sep === -1) return { text: content, hasContext: false, docTitle: null, pdfName: null, docPreview: null };
    const prefix = content.slice(0, sep);
    const text = content.slice(sep + 2);
    const docMatch = prefix.match(/\[Active Document: "([^"]+)"/);
    const pdfMatch = prefix.match(/\[Attached PDF: ([^\]]+)\]/);
    return { text, hasContext: true, docTitle: docMatch?.[1] ?? null, pdfName: pdfMatch?.[1] ?? null, docPreview: null };
  }

  function buildContextPrefix(): string {
    const parts: string[] = [];
    if (documentContext) {
      const wordHint = documentContext.fullText
        ? ` (~${Math.ceil(documentContext.fullText.trim().split(/\s+/).length / 50) * 50}+ words)`
        : "";
      parts.push(`[Active Document: "${documentContext.title}"${wordHint}]`);
      if (documentContext.outline.length > 0)
        parts.push(`[Outline:\n${documentContext.outline.join("\n")}]`);
      if (documentContext.selectedText) {
        const sel = documentContext.selectedText.length > 500
          ? documentContext.selectedText.slice(0, 500) + "..."
          : documentContext.selectedText;
        parts.push(`[Selected Text: "${sel}"]`);
      }
      if (documentContext.fullText) {
        const body = documentContext.fullText.length > 6000
          ? documentContext.fullText.slice(0, 6000) + "\n... [truncated]"
          : documentContext.fullText;
        parts.push(`[Document Content:\n${body}]`);
      }
    }
    if (attachedFile) {
      parts.push(`[Attached PDF: ${attachedFile.name}]\n${attachedFile.text}`);
    }
    return parts.length > 0 ? parts.join("\n") + CTX_SENTINEL : "";
  }

  function sendMessage() {
    if (!input.trim() || !activeSessionId || isSending) return;
    const userText = input.trim();
    const sessionId = activeSessionId;
    setInput("");

    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      session_id: sessionId,
      role: "user",
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setAttachedFile(null);

    const content = buildContextPrefix() + userText;

    contextSendMessage({
      sessionId,
      content,
      temperature: tuningParams?.temperature,
      maxTokens: tuningParams?.maxTokens,
      isAgent: activeMode === "agent",
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Drag & drop
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  const markdownComponents = useMemo(() => createMarkdownComponents(isDark), [isDark]);

  return (
    <div className="flex h-full overflow-hidden">
      <SessionSidebar
        accent="teal"
        icon={MessageSquare}
        newLabel="New Chat"
        sessionsLabel="Sessions"
        emptyLabel="No chats yet."
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={setActiveSessionId}
        onCreate={createSession}
        sessionMenu={sessionMenu}
        setSessionMenu={setSessionMenu}
        onStartRename={startRenameSession}
        renameId={renamingSessionId}
        renameValue={renameInput}
        onRenameChange={setRenameInput}
        onRenameCommit={commitRename}
        onRenameCancel={() => setRenamingSessionId(null)}
        deleteConfirmId={deleteConfirmId}
        setDeleteConfirmId={setDeleteConfirmId}
        onDelete={deleteSession}
        sidebarWidth={sidebarWidth}
        onResizeStart={onResizeStart}
      />

      {/* Main chat area */}
      <div
        className="relative flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden riso-noise"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <RisoBackground variant="chat" />
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg pointer-events-none">
            <div className="flex flex-col items-center gap-2 text-primary">
              <Upload className="h-8 w-8" />
              <span className="text-sm font-medium">Drop PDF here</span>
            </div>
          </div>
        )}
        {activeSessionId ? (
          <>
            {/* Header */}
            <div className="h-14 shrink-0 border-b px-4 flex items-center gap-3" style={{ position: 'relative', zIndex: 10 }}>
              {/* Editable session title */}
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTitle();
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  className="flex-1 font-display font-bold text-base bg-transparent border-b border-primary outline-none min-w-0"
                />
              ) : (
                <span
                  className="flex-1 font-display font-bold text-base truncate cursor-pointer hover:text-primary transition-colors riso-misreg-hover"
                  title="Click to rename"
                  onClick={startEditTitle}
                >
                  {activeSession?.title ?? "New Chat"}
                </span>
              )}

              {/* Document connection — pill button + popup */}
              <div className="relative" ref={docPickerRef}>
                {documentContext ? (
                  // Connected pill
                  <button
                    onClick={() => setShowDocPicker(v => !v)}
                    className="btn-tactile btn-tactile-teal"
                    title="Manage document connection"
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[140px]">{documentContext.title}</span>
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
                  </button>
                ) : (
                  // Connect button
                  <button
                    onClick={() => setShowDocPicker(v => !v)}
                    className="btn-tactile btn-tactile-outline"
                    title="Connect a document to provide context"
                  >
                    <Link2 className="h-3 w-3 shrink-0" />
                    Connect
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
                  </button>
                )}

                {/* Dropdown popup */}
                {showDocPicker && (
                  <div className="absolute top-full mt-1.5 right-0 z-50 bg-card border border-border-strong rounded-md min-w-[240px] max-w-[300px]"
                    style={{ boxShadow: "3px 3px 0 var(--riso-teal)" }}
                  >
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                      <span className="riso-section-label">Context Document</span>
                      {documentContext && (
                        <button
                          onClick={() => { onDisconnectDoc?.(); setShowDocPicker(false); }}
                          className="btn-tactile shrink-0"
                          style={{ fontSize: 10, padding: '1px 6px', color: 'var(--destructive)', borderColor: 'color-mix(in srgb, var(--destructive) 30%, transparent)' }}
                        >
                          <X className="h-2.5 w-2.5" />
                          Disconnect
                        </button>
                      )}
                    </div>
                    {docList.length > 0 ? (
                      <div className="max-h-[240px] overflow-y-auto py-1">
                        {docList.map(doc => {
                          const isActive = documentContext?.title === doc.title;
                          return (
                            <button
                              key={doc.id}
                              className="w-full text-left px-3 py-1.5 font-mono-ui text-xs transition-colors flex items-center gap-2"
                              style={{
                                background: isActive ? "color-mix(in srgb, var(--accent-teal) 10%, transparent)" : undefined,
                                color: isActive ? "var(--accent-teal)" : undefined,
                                fontWeight: isActive ? 600 : 400,
                              }}
                              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--background-3)"; }}
                              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = ""; }}
                              onClick={async () => {
                                try {
                                  const res = await axios.get(`${getAPIBase()}/documents/${doc.id}`);
                                  const extractText = (node: TipTapNode): string => {
                                    if (!node) return "";
                                    if (node.type === "text") return node.text || "";
                                    if (node.content) return node.content.map(extractText).join(node.type === "paragraph" ? "\n" : "");
                                    return "";
                                  };
                                  const fullText = extractText(res.data.content_json);
                                  onConnectDoc?.({ title: doc.title, outline: [], selectedText: null, fullText });
                                } catch {
                                  onConnectDoc?.({ title: doc.title, outline: [], selectedText: null, fullText: null });
                                }
                                setShowDocPicker(false);
                              }}
                            >
                              <FileText className="h-3 w-3 shrink-0" style={{ color: isActive ? "var(--accent-teal)" : "var(--muted-foreground)" }} />
                              <span className="truncate">{doc.title}</span>
                              {isActive && <Check className="h-3 w-3 shrink-0 ml-auto" style={{ color: "var(--accent-teal)" }} />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-3 py-3 font-mono-ui text-[11px] text-muted-foreground text-center">
                        No documents available
                      </div>
                    )}
                  </div>
                )}
              </div>

              <span className="riso-section-label shrink-0">Mode</span>
              <Select value={activeMode} onValueChange={changeMode}>
                <SelectTrigger
                  className="w-[130px] h-8 font-mono-ui text-xs tracking-wide"
                  style={{
                    border: "1.5px solid var(--border-strong)",
                    background: "var(--background-2)",
                    boxShadow: "2px 2px 0 var(--riso-teal)",
                    borderRadius: "4px",
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  style={{
                    border: "1.5px solid var(--border-strong)",
                    background: "var(--card)",
                    boxShadow: "3px 3px 0 var(--riso-teal)",
                    borderRadius: "4px",
                  }}
                >
                  {Object.entries(MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="font-mono-ui text-xs">{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span title={MODE_DESCRIPTIONS[activeMode]}>
                <Info className="h-4 w-4 text-muted-foreground cursor-help shrink-0" />
              </span>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4" style={{ position: 'relative', zIndex: 1 }}>
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2.5 animate-msg-in chat-msg-virtual",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {/* Avatar */}
                    {msg.role === "assistant" ? (
                      <div className="shrink-0 w-8 h-8 rounded-full bg-muted border border-border-strong flex items-center justify-center overflow-hidden">
                        <img src={agentCrowner} alt="AgentCrowner" className="w-5 h-5 object-contain" />
                      </div>
                    ) : (
                      <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg leading-none bg-muted border border-border-strong">
                        {userAvatar.emoji}
                      </div>
                    )}

                    {/* Bubble */}
                    <Card
                      className={cn(
                        "px-4 py-2.5 max-w-[80%] text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground card-riso card-riso-orange"
                          : "bg-card riso-bubble-ai"
                      )}
                    >
                      {msg.role === "user" ? (() => {
                        const { text, docTitle, pdfName, docPreview } = parseUserMessage(msg.content);
                        return (
                          <>
                            {(docTitle || pdfName) && (
                              <div className="flex flex-wrap gap-1 mb-1.5 -mt-0.5">
                                {docTitle && (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-primary-foreground/20 text-primary-foreground/80 rounded px-1.5 py-0.5" title={docPreview ? docPreview + "\n..." : undefined}>
                                    <FileText className="h-2.5 w-2.5" />
                                    {docTitle}
                                  </span>
                                )}
                                {pdfName && (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-primary-foreground/20 text-primary-foreground/80 rounded px-1.5 py-0.5">
                                    <FileText className="h-2.5 w-2.5" />
                                    {pdfName}
                                  </span>
                                )}
                              </div>
                            )}
                            <span className="whitespace-pre-wrap">{text}</span>
                          </>
                        );
                      })() : (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as never}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </Card>
                  </div>
                ))}
                {sending && (
                  <div className="flex gap-2.5 min-w-0">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-muted border border-border-strong flex items-center justify-center overflow-hidden">
                      <img src={agentCrowner} alt="AgentCrowner" className="w-5 h-5 object-contain" />
                    </div>
                    <Card className="px-4 py-2.5 bg-card riso-bubble-ai text-sm max-w-[80%] min-w-0 overflow-hidden">
                      {agentEvents.length > 0 && <ToolCallBubble events={agentEvents} />}
                      {isStreaming && streamingContent ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as never}>
                            {streamingContent}
                          </ReactMarkdown>
                        </div>
                      ) : agentEvents.length === 0 ? (
                        <span className="inline-flex items-center gap-1.5 font-mono-ui text-[11px] text-muted-foreground animate-riso-pulse">
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-teal)', display: 'inline-block' }} />
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-orange)', display: 'inline-block', animationDelay: '0.2s' }} className="animate-riso-pulse" />
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-violet)', display: 'inline-block', animationDelay: '0.4s' }} className="animate-riso-pulse" />
                        </span>
                      ) : null}
                    </Card>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="border-t px-4 py-3 shrink-0 surface-noise" style={{ position: 'relative', zIndex: 1 }}>
              <div className="max-w-3xl mx-auto space-y-2">
                {/* Attached file chip */}
                {attachedFile && (
                  <div className="tag-riso tag-riso-teal inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md w-fit max-w-full">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                    <button
                      onClick={() => setAttachedFile(null)}
                      className="hover:text-destructive ml-1 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  {/* File attach button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }}
                  />
                  <button
                    className="btn-tactile btn-tactile-outline shrink-0 h-[44px] w-[44px] justify-center"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    title="Attach PDF"
                  >
                    {uploadingFile
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Paperclip className="h-4 w-4" />}
                  </button>

                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                    className="min-h-[44px] max-h-[160px] resize-none border-border-strong"
                    rows={1}
                    disabled={sending}
                  />
                  {sending ? (
                    <button
                      onClick={stopStreaming}
                      className="btn-tactile shrink-0 h-[44px] w-[44px] justify-center"
                      style={{ background: 'var(--destructive)', color: '#fff', borderColor: 'rgba(0,0,0,0.18)' }}
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim()}
                      className="btn-tactile btn-tactile-teal shrink-0 h-[44px] w-[44px] justify-center"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 relative flex flex-col items-center justify-center gap-7 select-none">
            <div className="animate-crower-pulse-chat" style={{ position: 'relative', zIndex: 1, width: 220, height: 220, borderRadius: '50%', overflow: 'hidden', background: '#0a0806', flexShrink: 0 }}>
              <img src={agentCrowner} alt="AgentCrowner" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              {/* light sweep overlay */}
              <div className="animate-crower-shine" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)', borderRadius: '50%' }} />
            </div>
            <div className="text-center space-y-2" style={{ position: 'relative', zIndex: 1 }}>
              <p className="font-mono-ui uppercase" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--accent-teal)', opacity: 0.85 }}>Agent Crower</p>
              <h2
                className="font-display font-black tracking-tight leading-none"
                style={{ fontSize: 'clamp(2.8rem, 6vw, 4.2rem)', textShadow: '4px 4px 0 rgba(224,78,14,0.22), -2px -2px 0 rgba(11,114,104,0.18)', letterSpacing: '-0.02em' }}
              >
                CrowForge
              </h2>
              <p className="text-sm text-muted-foreground text-center whitespace-nowrap">
                Ask anything — chat with AI using your documents as context.
              </p>
              <p className="font-mono-ui uppercase" style={{ fontSize: 12, letterSpacing: '0.12em', paddingLeft: '0.12em', color: 'var(--muted-foreground)', opacity: 0.7, whiteSpace: 'nowrap', textAlign: 'center' }}>
                Your local-first AI workspace
              </p>
            </div>
            <div className="flex items-center gap-2" style={{ position: 'relative', zIndex: 1 }}>
              <span style={{ width: 28, height: 5, borderRadius: 3, background: 'var(--accent-orange)', opacity: 0.75, display: 'block' }} />
              <span style={{ width: 28, height: 5, borderRadius: 3, background: 'var(--accent-teal)', opacity: 0.75, display: 'block' }} />
              <span style={{ width: 28, height: 5, borderRadius: 3, background: 'var(--accent-violet)', opacity: 0.75, display: 'block' }} />
            </div>
            <p className="riso-stamp text-center" style={{ position: 'relative', zIndex: 1, color: 'var(--accent-teal)', fontSize: 13 }}>Select or create a chat to begin</p>
          </div>
        )}
      </div>

    </div>
  );
}
