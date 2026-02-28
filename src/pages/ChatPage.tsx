import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  PlusCircle, Send, Trash2, MessageSquare, Loader2, FileText,
  Paperclip, X, Copy, Check, Info, Upload, Square, Pencil,
} from "lucide-react";
import { useChatStream } from "../contexts/ChatStreamContext";
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
import { toast } from "../hooks/useToast";
import type { DocumentContext } from "../App";
import type { TuningParams } from "../components/AIControlPanel";
import crowforgeIco from "../assets/crowforge_ico.png";

const API_BASE = "http://127.0.0.1:8000";

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

interface AttachedFile {
  name: string;
  text: string;
}

interface ChatPageProps {
  documentContext?: DocumentContext | null;
  onDisconnectDoc?: () => void;
  onConnectDoc?: (ctx: DocumentContext) => void;
  tuningParams?: TuningParams;
}

function useIsDark() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function CodeBlock({ code, language, isDark }: { code: string; language: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative group my-2">
      <button
        onClick={copy}
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-muted/80 hover:bg-muted rounded p-1"
        title="Copy code"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <SyntaxHighlighter
        language={language || "text"}
        style={isDark ? oneDark : oneLight}
        customStyle={{ margin: 0, borderRadius: "0.375rem", fontSize: "0.8rem" }}
        PreTag="div"
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export function ChatPage({ documentContext, onDisconnectDoc, onConnectDoc, tuningParams }: ChatPageProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeMode, setActiveMode] = useState("general");
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
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const sidebarResizing = useRef(false);
  const sidebarResizeStart = useRef(0);
  const sidebarWidthStart = useRef(220);

  const {
    streamingSessionId, streamingContent, isStreaming, isSending,
    sendMessage: contextSendMessage, stopStreaming, onStreamDone, onStreamError,
  } = useChatStream();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

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
    axios.get(`${API_BASE}/documents`).then(r => {
      const docs = Array.isArray(r.data) ? r.data : r.data.documents ?? [];
      setDocList(docs);
    }).catch(() => {});
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (renamingSessionId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingSessionId]);

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

  // Close session context menu on outside click
  useEffect(() => {
    if (!sessionMenu) return;
    const close = () => setSessionMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [sessionMenu]);

  // Sidebar resize via mouse drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!sidebarResizing.current) return;
      const delta = e.clientX - sidebarResizeStart.current;
      setSidebarWidth(Math.max(160, Math.min(400, sidebarWidthStart.current + delta)));
    };
    const onUp = () => { sidebarResizing.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  async function loadSessions() {
    try {
      const res = await axios.get(`${API_BASE}/chat/sessions`);
      setSessions(res.data);
    } catch { /* backend may be offline */ }
  }

  async function loadMessages(sessionId: number) {
    try {
      const res = await axios.get(`${API_BASE}/chat/session/${sessionId}`);
      setMessages(res.data.messages);
      if (res.data.session?.mode) setActiveMode(res.data.session.mode);
    } catch { setMessages([]); }
  }

  async function createSession() {
    try {
      const res = await axios.post(`${API_BASE}/chat/session`, { mode: "general" });
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
      await axios.delete(`${API_BASE}/chat/session/${id}`);
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
      const res = await axios.put(`${API_BASE}/chat/session/${activeSessionId}/mode`, { mode });
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
      await axios.put(`${API_BASE}/chat/session/${sessionId}/title`, { title: t });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: t } : s))
      );
    } catch { /* ignore */ }
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
      const res = await axios.post(`${API_BASE}/chat/upload`, form);
      setAttachedFile({ name: res.data.filename, text: res.data.text });
    } catch { /* ignore */ }
    setUploadingFile(false);
  }

  /** Strip the context prefix that was prepended before sending to AI.
   *  The prefix always ends with \n\n before the actual user text.
   *  Returns { text, hasContext, docTitle } */
  function parseUserMessage(content: string): { text: string; hasContext: boolean; docTitle: string | null; pdfName: string | null } {
    if (!content.startsWith("[")) return { text: content, hasContext: false, docTitle: null, pdfName: null };
    const sep = content.indexOf("\n\n");
    if (sep === -1) return { text: content, hasContext: false, docTitle: null, pdfName: null };
    const prefix = content.slice(0, sep);
    const text = content.slice(sep + 2);
    const docMatch = prefix.match(/\[Active Document: "([^"]+)"/);
    const pdfMatch = prefix.match(/\[Attached PDF: ([^\]]+)\]/);
    return { text, hasContext: true, docTitle: docMatch?.[1] ?? null, pdfName: pdfMatch?.[1] ?? null };
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
    return parts.length > 0 ? parts.join("\n") + "\n\n" : "";
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

  const markdownComponents = {
    code({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      const isBlock = match || codeString.includes("\n");
      if (isBlock) {
        return (
          <CodeBlock
            code={codeString}
            language={match ? match[1] : "text"}
            isDark={isDark}
          />
        );
      }
      return (
        <code className="bg-muted px-1 py-0.5 rounded text-[0.8em] font-mono" {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="shrink-0 border-r bg-background flex flex-col relative" style={{ width: sidebarWidth }}>
        <div className="p-3 border-b">
          <Button variant="outline" size="sm" className="w-full" onClick={createSession}>
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
                onClick={() => { if (renamingSessionId !== s.id) setActiveSessionId(s.id); }}
                onDoubleClick={() => startRenameSession(s.id, s.title)}
                onContextMenu={(e) => { e.preventDefault(); setSessionMenu({ sessionId: s.id, x: e.clientX, y: e.clientY }); }}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                {renamingSessionId === s.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenamingSessionId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-transparent outline-none border-b border-primary text-xs min-w-0"
                  />
                ) : (
                  <span className="flex-1 truncate">{s.title}</span>
                )}
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No chats yet.</p>
            )}
          </div>
        </ScrollArea>
        {/* Resize handle */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/40 z-10 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            sidebarResizing.current = true;
            sidebarResizeStart.current = e.clientX;
            sidebarWidthStart.current = sidebarWidth;
          }}
        />
      </div>

      {/* Session context menu */}
      {sessionMenu && (
        <div
          className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[150px] text-sm"
          style={{ left: sessionMenu.x, top: sessionMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2"
            onClick={() => { startRenameSession(sessionMenu.sessionId, sessions.find(s => s.id === sessionMenu.sessionId)?.title ?? ""); setSessionMenu(null); }}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Rename
          </button>
          <div className="border-t border-border my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 text-destructive"
            onClick={() => { deleteSession(sessionMenu.sessionId); setSessionMenu(null); }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      {/* Main chat area */}
      <div
        className="relative flex-1 flex flex-col min-w-0"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
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
            <div className="border-b px-4 py-2 flex items-center gap-3">
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
                  className="flex-1 text-sm font-medium bg-transparent border-b border-primary outline-none min-w-0"
                />
              ) : (
                <span
                  className="flex-1 text-sm font-medium truncate cursor-pointer hover:text-primary transition-colors"
                  title="Click to rename"
                  onClick={startEditTitle}
                >
                  {activeSession?.title ?? "New Chat"}
                </span>
              )}

              {documentContext && (() => {
                const parts: string[] = ["title"];
                if (documentContext.outline.length > 0) parts.push(`outline (${documentContext.outline.length} headings)`);
                if (documentContext.selectedText) parts.push("selected text");
                if (documentContext.fullText) parts.push("full body");
                const tip = `Connected: "${documentContext.title}"\nSending: ${parts.join(", ")}\nClick × to disconnect`;
                return (
                  <div
                    className="flex items-center gap-1 text-xs bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full"
                    title={tip}
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[200px]">{documentContext.title}</span>
                    <button
                      onClick={onDisconnectDoc}
                      className="ml-0.5 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                      title="Disconnect document"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })()}

              {!documentContext && docList.length > 0 && (
                <div className="relative" ref={docPickerRef}>
                  <button
                    onClick={() => setShowDocPicker(!showDocPicker)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <FileText className="h-3.5 w-3.5" /> Connect document
                  </button>
                  {showDocPicker && (
                    <div className="absolute top-full mt-1 left-0 z-50 bg-background border rounded-md shadow-lg min-w-[200px] max-h-[240px] overflow-y-auto">
                      {docList.map(doc => (
                        <button
                          key={doc.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted truncate"
                          onClick={() => { onConnectDoc?.({ title: doc.title, outline: [], selectedText: null, fullText: null }); setShowDocPicker(false); }}
                        >
                          {doc.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <span className="text-xs font-medium text-muted-foreground shrink-0">Mode</span>
              <Select value={activeMode} onValueChange={changeMode}>
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span title={MODE_DESCRIPTIONS[activeMode]}>
                <Info className="h-4 w-4 text-muted-foreground cursor-help shrink-0" />
              </span>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2",
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {/* Avatar */}
                    {msg.role === "assistant" ? (
                      <div className="shrink-0 w-7 h-7 rounded-full bg-muted border flex items-center justify-center overflow-hidden">
                        <img src={crowforgeIco} alt="CrowForge" className="w-5 h-5 object-contain" />
                      </div>
                    ) : (
                      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none bg-muted">
                        {userAvatar.emoji}
                      </div>
                    )}

                    {/* Bubble */}
                    <Card
                      className={cn(
                        "px-4 py-2.5 max-w-[80%] text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {msg.role === "user" ? (() => {
                        const { text, docTitle, pdfName } = parseUserMessage(msg.content);
                        return (
                          <>
                            {(docTitle || pdfName) && (
                              <div className="flex flex-wrap gap-1 mb-1.5 -mt-0.5">
                                {docTitle && (
                                  <span className="inline-flex items-center gap-1 text-[10px] bg-primary-foreground/20 text-primary-foreground/80 rounded px-1.5 py-0.5">
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
                  <div className="flex gap-2 min-w-0">
                    <div className="shrink-0 w-7 h-7 rounded-full bg-muted border flex items-center justify-center overflow-hidden">
                      <img src={crowforgeIco} alt="CrowForge" className="w-5 h-5 object-contain" />
                    </div>
                    <Card className="px-4 py-2.5 bg-muted text-sm max-w-[80%] min-w-0 overflow-hidden">
                      {isStreaming && streamingContent ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as never}>
                            {streamingContent}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </Card>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-4">
              <div className="max-w-3xl mx-auto space-y-2">
                {/* Attached file chip */}
                {attachedFile && (
                  <div className="flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/30 text-primary px-2.5 py-1.5 rounded-md w-fit max-w-full font-medium">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                    <button
                      onClick={() => setAttachedFile(null)}
                      className="text-muted-foreground hover:text-destructive ml-1"
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
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 h-[44px] w-[44px]"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    title="Attach PDF"
                  >
                    {uploadingFile
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Paperclip className="h-4 w-4" />}
                  </Button>

                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                    className="min-h-[44px] max-h-[160px] resize-none"
                    rows={1}
                    disabled={sending}
                  />
                  {sending ? (
                    <Button
                      onClick={stopStreaming}
                      variant="destructive"
                      size="icon"
                      className="shrink-0 h-[44px] w-[44px]"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={sendMessage}
                      disabled={!input.trim()}
                      size="icon"
                      className="shrink-0 h-[44px] w-[44px]"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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
