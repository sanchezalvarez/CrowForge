import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  PlusCircle, Send, Trash2, Bot, Loader2, Square, Pencil,
  Wrench, ChevronDown, ChevronRight, Check, Copy,
  Table2, FileText, Settings2, XCircle, Play, AlertTriangle,
} from "lucide-react";
import type { AgentEvent } from "../hooks/useFetchSSE";
import type { AgentScope } from "../contexts/ChatStreamContext";
import { useChatStream } from "../contexts/ChatStreamContext";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { ScrollArea } from "../components/ui/scroll-area";
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";
import { toast } from "../hooks/useToast";
import type { TuningParams } from "../components/AIControlPanel";
const API_BASE = "http://127.0.0.1:8000";

// ── Accent color utilities ─────────────────────────────────────────
// The agent page uses violet instead of the app's primary color.
const ACCENT = {
  bg: "bg-violet-500/10",
  bgSolid: "bg-violet-600 dark:bg-violet-500",
  text: "text-violet-600 dark:text-violet-400",
  textFg: "text-white",
  border: "border-violet-500/30",
  hoverBg: "hover:bg-violet-500/15",
  ring: "focus-visible:ring-violet-500",
};

// ── Types ───────────────────────────────────────────────────────────
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
  metadata?: string | null;
  created_at: string;
}

interface ScopeItem {
  id: string;
  title: string;
  type: "sheet" | "document";
}

interface AgentPageProps {
  tuningParams?: TuningParams;
}

// ── Helpers ─────────────────────────────────────────────────────────
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

// ── Agent Status Banner ─────────────────────────────────────────────
function AgentStatusBanner({ events, isSending, isStreaming }: { events: AgentEvent[]; isSending: boolean; isStreaming: boolean }) {
  if (!isSending) return null;

  // Find the latest in-progress tool (started but not finished)
  const startedIds = new Set<string>();
  const finishedIds = new Set<string>();
  for (const evt of events) {
    if (evt.type === "started_tool" && evt.call_id) startedIds.add(evt.call_id);
    if ((evt.type === "finished_tool" || evt.type === "tool_error") && evt.call_id) finishedIds.add(evt.call_id);
  }
  const runningId = [...startedIds].find(id => !finishedIds.has(id));
  const runningTool = runningId
    ? events.find(e => e.type === "started_tool" && e.call_id === runningId)
    : null;

  let label: string;
  let icon: React.ReactNode;

  if (runningTool) {
    label = `Executing: ${runningTool.tool}`;
    icon = <Wrench className="h-3.5 w-3.5 animate-pulse" />;
  } else if (isStreaming) {
    label = "Agent is responding...";
    icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  } else if (events.some(e => e.type === "thinking")) {
    label = "Agent is thinking...";
    icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  } else {
    label = "Agent is thinking...";
    icon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  }

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border",
      "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300",
    )}>
      {icon}
      {label}
    </div>
  );
}

// ── Tool Call Bubble (Agent-flavored) ───────────────────────────────
type ApplyState = "idle" | "applying" | "applied" | "error";

function AgentToolBubble({ events, sessionId, isSending }: { events: AgentEvent[]; sessionId?: number | null; isSending?: boolean }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [applyStates, setApplyStates] = useState<Record<string, ApplyState>>({});
  const [applyErrors, setApplyErrors] = useState<Record<string, string>>({});
  if (events.length === 0) return null;

  type ThinkingStep = { kind: "thinking"; content: string };
  type ToolStep = { kind: "tool"; callId: string; tool: string; args: Record<string, unknown>; result?: string; durationMs?: number; finished: boolean; hasError: boolean; errorText?: string; isPreview: boolean; previewDesc?: string };
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
        hasError: false,
        isPreview: false,
      };
      steps.push(step);
      toolMap.set(step.callId, step);
    } else if (evt.type === "finished_tool") {
      const existing = toolMap.get(evt.call_id ?? "");
      if (existing) {
        existing.result = evt.result;
        existing.durationMs = evt.duration_ms;
        existing.finished = true;
        // Check if result is a preview
        try {
          const parsed = JSON.parse(evt.result ?? "{}");
          if (parsed.preview === true) {
            existing.isPreview = true;
            existing.previewDesc = parsed.description ?? `${parsed.action}`;
          }
        } catch { /* not json */ }
      }
    } else if (evt.type === "tool_error") {
      const existing = toolMap.get(evt.call_id ?? "");
      if (existing) {
        existing.finished = true;
        existing.hasError = true;
        existing.errorText = evt.error ?? "Unknown error";
        existing.durationMs = evt.duration_ms;
      }
    }
  }

  async function handleApply(step: ToolStep) {
    if (!sessionId) return;
    setApplyStates(prev => ({ ...prev, [step.callId]: "applying" }));
    try {
      // Parse the preview result to get args for the actual call
      const parsed = JSON.parse(step.result ?? "{}");
      const { preview: _, action, description: __, ...args } = parsed;
      const res = await axios.post(`${API_BASE}/chat/session/${sessionId}/agent/apply-write`, {
        tool: action,
        args,
      });
      if (res.data?.error) {
        setApplyStates(prev => ({ ...prev, [step.callId]: "error" }));
        setApplyErrors(prev => ({ ...prev, [step.callId]: res.data.error }));
      } else {
        setApplyStates(prev => ({ ...prev, [step.callId]: "applied" }));
      }
    } catch (e: unknown) {
      setApplyStates(prev => ({ ...prev, [step.callId]: "error" }));
      const msg = axios.isAxiosError(e) ? (e.response?.data?.detail ?? e.message) : String(e);
      setApplyErrors(prev => ({ ...prev, [step.callId]: msg }));
    }
  }

  return (
    <div className="space-y-1.5 mb-2">
      {steps.map((step, i) => {
        if (step.kind === "thinking") {
          return (
            <div key={`t${i}`} className="text-xs text-violet-600/70 dark:text-violet-400/70 italic px-1 py-0.5">
              {step.content}
            </div>
          );
        }
        const key = step.callId;
        const isOpen = expanded[key] ?? false;
        const applyState = applyStates[key] ?? "idle";
        return (
          <div key={key} className={cn("border rounded-md text-xs", step.hasError ? "border-red-500/30 bg-red-500/5" : "border-violet-500/20 bg-violet-500/5")}>
            <button
              className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left hover:bg-violet-500/10 transition-colors"
              onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
            >
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Wrench className="h-3 w-3 text-violet-500" />
              <span className="font-medium">{step.tool}</span>
              {step.finished ? (
                <span className="ml-auto flex items-center gap-1.5">
                  {step.durationMs != null && (
                    <span className="text-muted-foreground">{step.durationMs}ms</span>
                  )}
                  {step.hasError ? (
                    <XCircle className="h-3 w-3 text-red-500" />
                  ) : step.isPreview ? (
                    <span className="text-violet-500 text-[10px] font-medium">Preview</span>
                  ) : (
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  )}
                </span>
              ) : (
                <Loader2 className="h-3 w-3 animate-spin ml-auto text-violet-500" />
              )}
            </button>
            {isOpen && (
              <div className="px-2.5 pb-2 space-y-1 border-t border-violet-500/20">
                {Object.keys(step.args).length > 0 && (
                  <div className="mt-1.5">
                    <span className="text-muted-foreground">Args: </span>
                    <code className="text-[10px]">{JSON.stringify(step.args)}</code>
                  </div>
                )}
                {step.hasError && step.errorText && (
                  <div className="mt-1.5 text-red-600 dark:text-red-400">
                    <span className="font-medium">Error: </span>
                    <span>{step.errorText}</span>
                  </div>
                )}
                {step.result && !step.hasError && (
                  <div>
                    <span className="text-muted-foreground">Result: </span>
                    <code className="text-[10px] break-all">{
                      step.result.length > 500
                        ? step.result.slice(0, 500) + "..."
                        : step.result
                    }</code>
                  </div>
                )}
                {step.isPreview && step.previewDesc && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-violet-600 dark:text-violet-400">{step.previewDesc}</span>
                    {applyState === "idle" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApply(step); }}
                        disabled={isSending}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-600 text-white text-[10px] font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
                      >
                        <Play className="h-2.5 w-2.5" /> Apply
                      </button>
                    )}
                    {applyState === "applying" && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-violet-500">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Applying...
                      </span>
                    )}
                    {applyState === "applied" && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-medium">
                        <Check className="h-2.5 w-2.5" /> Applied
                      </span>
                    )}
                    {applyState === "error" && (
                      <span className="text-[10px] text-red-500">{applyErrors[key] ?? "Failed"}</span>
                    )}
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

// ── Context Selector Panel ──────────────────────────────────────────
function ContextSelector({
  sheets,
  documents,
  selectedSheetIds,
  selectedDocumentIds,
  onToggleSheet,
  onToggleDocument,
  onSelectAllSheets,
  onSelectAllDocuments,
  onClearAll,
}: {
  sheets: ScopeItem[];
  documents: ScopeItem[];
  selectedSheetIds: Set<string>;
  selectedDocumentIds: Set<string>;
  onToggleSheet: (id: string) => void;
  onToggleDocument: (id: string) => void;
  onSelectAllSheets: () => void;
  onSelectAllDocuments: () => void;
  onClearAll: () => void;
}) {
  const totalSelected = selectedSheetIds.size + selectedDocumentIds.size;
  const allSelected = totalSelected === sheets.length + documents.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agent Context</span>
        {totalSelected > 0 && (
          <button onClick={onClearAll} className="text-[10px] text-muted-foreground hover:text-foreground">
            Clear all
          </button>
        )}
      </div>

      {allSelected && (
        <div className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
          All items selected — agent can access everything
        </div>
      )}

      {sheets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium flex items-center gap-1">
              <Table2 className="h-3 w-3" /> Sheets
            </span>
            <button onClick={onSelectAllSheets} className="text-[10px] text-muted-foreground hover:text-foreground">
              {selectedSheetIds.size === sheets.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="space-y-0.5">
            {sheets.map(s => (
              <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={selectedSheetIds.has(s.id)}
                  onChange={() => onToggleSheet(s.id)}
                  className="rounded border-muted-foreground accent-violet-600"
                />
                <span className="truncate">{s.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium flex items-center gap-1">
              <FileText className="h-3 w-3" /> Documents
            </span>
            <button onClick={onSelectAllDocuments} className="text-[10px] text-muted-foreground hover:text-foreground">
              {selectedDocumentIds.size === documents.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="space-y-0.5">
            {documents.map(d => (
              <label key={d.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={selectedDocumentIds.has(d.id)}
                  onChange={() => onToggleDocument(d.id)}
                  className="rounded border-muted-foreground accent-violet-600"
                />
                <span className="truncate">{d.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {sheets.length === 0 && documents.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">No sheets or documents yet. Create some first.</p>
      )}
    </div>
  );
}

// ── Main Agent Page ─────────────────────────────────────────────────
export function AgentPage({ tuningParams }: AgentPageProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [renamingSessionId, setRenamingSessionId] = useState<number | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [sessionMenu, setSessionMenu] = useState<{ sessionId: number; x: number; y: number } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const sidebarResizing = useRef(false);
  const sidebarResizeStart = useRef(0);
  const sidebarWidthStart = useRef(220);
  const [showContextPanel, setShowContextPanel] = useState(false);

  // Scope state
  const [allSheets, setAllSheets] = useState<ScopeItem[]>([]);
  const [allDocuments, setAllDocuments] = useState<ScopeItem[]>([]);
  const [selectedSheetIds, setSelectedSheetIds] = useState<Set<string>>(new Set());
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [supportsTools, setSupportsTools] = useState<boolean | null>(null);
  const [modelLabel, setModelLabel] = useState<string>("");

  const {
    streamingSessionId, streamingContent, isStreaming, isSending,
    sendMessage: contextSendMessage, stopStreaming, onStreamDone, onStreamError,
    agentEvents,
  } = useChatStream();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const isDark = useIsDark();
  const contextPanelRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const sending = isSending && streamingSessionId === activeSessionId;

  // Load sessions (agent mode only)
  useEffect(() => { loadSessions(); }, []);

  // Check if current engine supports tool calling
  useEffect(() => {
    axios.get(`${API_BASE}/settings/ai/status`).then(r => {
      setSupportsTools(r.data.supports_tools ?? false);
      setModelLabel(r.data.model_label || r.data.active_engine || "Current model");
    }).catch(() => {});
  }, []);

  // Load scope items
  useEffect(() => {
    axios.get(`${API_BASE}/sheets`).then(r => {
      const items = (Array.isArray(r.data) ? r.data : []).map((s: { id: string; title: string }) => ({ id: s.id, title: s.title, type: "sheet" as const }));
      setAllSheets(items);
      // Default: all selected
      setSelectedSheetIds(new Set(items.map((s: ScopeItem) => s.id)));
    }).catch(() => {});
    axios.get(`${API_BASE}/documents`).then(r => {
      const docs = Array.isArray(r.data) ? r.data : r.data.documents ?? [];
      const items = docs.map((d: { id: string; title: string }) => ({ id: d.id, title: d.title, type: "document" as const }));
      setAllDocuments(items);
      setSelectedDocumentIds(new Set(items.map((d: ScopeItem) => d.id)));
    }).catch(() => {});
  }, []);

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
    if (activeSessionId) loadMessages(activeSessionId);
    else setMessages([]);
  }, [activeSessionId]);

  // Stream callbacks
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
    return () => { onStreamDone.current = null; onStreamError.current = null; };
  }, [handleStreamDone, handleStreamError]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, agentEvents]);

  useEffect(() => {
    if (renamingSessionId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingSessionId]);

  // Close session context menu on outside click
  useEffect(() => {
    if (!sessionMenu) return;
    const close = () => setSessionMenu(null);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [sessionMenu]);

  // Close context panel on outside click
  useEffect(() => {
    if (!showContextPanel) return;
    function onClickOutside(e: MouseEvent) {
      if (contextPanelRef.current && !contextPanelRef.current.contains(e.target as Node)) {
        setShowContextPanel(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showContextPanel]);

  // Sidebar resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!sidebarResizing.current) return;
      const delta = e.clientX - sidebarResizeStart.current;
      setSidebarWidth(Math.max(160, Math.min(400, sidebarWidthStart.current + delta)));
    };
    const onUp = () => { sidebarResizing.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, []);

  async function loadSessions() {
    try {
      const res = await axios.get(`${API_BASE}/chat/sessions?mode=agent`);
      setSessions(res.data as ChatSession[]);
    } catch { /* backend may be offline */ }
  }

  async function loadMessages(sessionId: number) {
    try {
      const res = await axios.get(`${API_BASE}/chat/session/${sessionId}`);
      setMessages(res.data.messages);
    } catch { setMessages([]); }
  }

  async function createSession() {
    try {
      const res = await axios.post(`${API_BASE}/chat/session`, { mode: "agent" });
      const session: ChatSession = res.data;
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
    } catch {
      toast("Failed to create agent session.", "error");
    }
  }

  async function deleteSession(id: number) {
    try {
      await axios.delete(`${API_BASE}/chat/session/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); }
    } catch {
      toast("Failed to delete session.", "error");
    }
  }

  async function saveTitle(sessionId: number, title: string) {
    const t = title.trim();
    if (!t) return;
    try {
      await axios.put(`${API_BASE}/chat/session/${sessionId}/title`, { title: t });
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: t } : s)));
    } catch { /* ignore */ }
  }

  function startRenameSession(id: number, currentTitle: string) {
    setRenamingSessionId(id);
    setRenameInput(currentTitle);
  }

  function commitRename() {
    if (renamingSessionId && renameInput.trim()) saveTitle(renamingSessionId, renameInput);
    setRenamingSessionId(null);
  }

  function buildScope(): AgentScope | undefined {
    const allSheetsSelected = selectedSheetIds.size === allSheets.length;
    const allDocsSelected = selectedDocumentIds.size === allDocuments.length;
    if (allSheetsSelected && allDocsSelected) return undefined; // no filter = full access
    return {
      sheet_ids: [...selectedSheetIds],
      document_ids: [...selectedDocumentIds],
    };
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

    contextSendMessage({
      sessionId,
      content: userText,
      temperature: tuningParams?.temperature,
      maxTokens: tuningParams?.maxTokens,
      isAgent: true,
      scope: buildScope(),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const markdownComponents = {
    code({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      const isBlock = match || codeString.includes("\n");
      if (isBlock) {
        return <CodeBlock code={codeString} language={match ? match[1] : "text"} isDark={isDark} />;
      }
      return (
        <code className="bg-muted px-1 py-0.5 rounded text-[0.8em] font-mono" {...props}>
          {children}
        </code>
      );
    },
  };

  const scopeCount = selectedSheetIds.size + selectedDocumentIds.size;
  const totalCount = allSheets.length + allDocuments.length;

  return (
    <div className="flex h-full">
      {/* Sessions sidebar */}
      <div className="shrink-0 border-r bg-background flex flex-col relative" style={{ width: sidebarWidth }}>
        <div className="p-3 border-b">
          <Button
            variant="outline"
            size="sm"
            className={cn("w-full border-violet-500/30", ACCENT.text, ACCENT.hoverBg)}
            onClick={createSession}
          >
            <PlusCircle className="h-4 w-4 mr-1.5" />
            New Agent Chat
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
                    ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 font-medium"
                    : "text-muted-foreground hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400"
                )}
                onClick={() => { if (renamingSessionId !== s.id) setActiveSessionId(s.id); }}
                onDoubleClick={() => startRenameSession(s.id, s.title)}
                onContextMenu={(e) => { e.preventDefault(); setSessionMenu({ sessionId: s.id, x: e.clientX, y: e.clientY }); }}
              >
                <Bot className="h-3.5 w-3.5 shrink-0" />
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
                    className="flex-1 bg-transparent outline-none border-b border-violet-500 text-xs min-w-0"
                  />
                ) : (
                  <span className="flex-1 truncate">{s.title}</span>
                )}
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No agent chats yet.</p>
            )}
          </div>
        </ScrollArea>
        {/* Resize handle */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-violet-400/40 z-10 transition-colors"
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
      <div className="relative flex-1 flex flex-col min-w-0">
        {activeSessionId ? (
          <>
            {/* Header */}
            <div className="border-b px-4 py-2 flex items-center gap-3">
              <div className="flex items-center gap-1.5 shrink-0">
                <Bot className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">Agent</span>
              </div>

              <span className="text-sm text-muted-foreground truncate flex-1">
                {activeSession?.title ?? "New Agent Chat"}
              </span>

              {/* Context selector trigger */}
              <div className="relative" ref={contextPanelRef}>
                <button
                  onClick={() => setShowContextPanel(!showContextPanel)}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors",
                    showContextPanel
                      ? "bg-violet-500/15 border-violet-500/40 text-violet-600 dark:text-violet-400"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-violet-500/30",
                  )}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Context
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    scopeCount === totalCount
                      ? "bg-violet-500/20 text-violet-600 dark:text-violet-400"
                      : scopeCount === 0
                        ? "bg-red-500/20 text-red-600 dark:text-red-400"
                        : "bg-violet-500/20 text-violet-600 dark:text-violet-400",
                  )}>
                    {scopeCount === totalCount ? "All" : `${scopeCount}/${totalCount}`}
                  </span>
                </button>

                {showContextPanel && (
                  <div className="absolute top-full mt-1 right-0 z-50 bg-background border rounded-lg shadow-lg p-3 min-w-[260px] max-h-[400px] overflow-y-auto">
                    <ContextSelector
                      sheets={allSheets}
                      documents={allDocuments}
                      selectedSheetIds={selectedSheetIds}
                      selectedDocumentIds={selectedDocumentIds}
                      onToggleSheet={(id) => setSelectedSheetIds(prev => {
                        const next = new Set(prev);
                        next.has(id) ? next.delete(id) : next.add(id);
                        return next;
                      })}
                      onToggleDocument={(id) => setSelectedDocumentIds(prev => {
                        const next = new Set(prev);
                        next.has(id) ? next.delete(id) : next.add(id);
                        return next;
                      })}
                      onSelectAllSheets={() => setSelectedSheetIds(prev =>
                        prev.size === allSheets.length ? new Set() : new Set(allSheets.map(s => s.id))
                      )}
                      onSelectAllDocuments={() => setSelectedDocumentIds(prev =>
                        prev.size === allDocuments.length ? new Set() : new Set(allDocuments.map(d => d.id))
                      )}
                      onClearAll={() => { setSelectedSheetIds(new Set()); setSelectedDocumentIds(new Set()); }}
                    />
                  </div>
                )}
              </div>

              {/* Status banner */}
              <AgentStatusBanner events={agentEvents} isSending={sending} isStreaming={isStreaming} />
            </div>

            {/* Tool support warning */}
            {supportsTools === false && (
              <div className="mx-4 mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-md">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong>{modelLabel}</strong> does not support tool calling — the agent cannot read or write your data.
                  Switch to an HTTP engine or download a model tagged <strong>agent</strong> in Settings &gt; Model Gallery.
                </span>
              </div>
            )}

            {/* Scope warning */}
            {scopeCount === 0 && supportsTools !== false && (
              <div className="mx-4 mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-md">
                No items selected — the agent won't be able to access any sheets or documents.
                <button
                  onClick={() => setShowContextPanel(true)}
                  className="underline hover:no-underline font-medium"
                >
                  Configure context
                </button>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
                  >
                    {/* Avatar */}
                    {msg.role === "assistant" ? (
                      <div className="shrink-0 w-7 h-7 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-violet-500" />
                      </div>
                    ) : (
                      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none bg-muted">
                        {(() => {
                          const idx = parseInt(localStorage.getItem("user_avatar_index") ?? "0", 10);
                          const avatars = ["🐱","🐶","🐰","🦜","🐟","🦊","🐢","🐸","🐼","🦋","🐧","🦔"];
                          return avatars[idx] ?? "🐱";
                        })()}
                      </div>
                    )}

                    {/* Bubble */}
                    <Card
                      className={cn(
                        "px-4 py-2.5 max-w-[80%] text-sm",
                        msg.role === "user"
                          ? "bg-violet-600 dark:bg-violet-500 text-white"
                          : "bg-muted"
                      )}
                    >
                      {msg.role === "user" ? (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      ) : (
                        <>
                          {msg.metadata && (() => {
                            try {
                              const events: AgentEvent[] = JSON.parse(msg.metadata);
                              if (Array.isArray(events) && events.length > 0) {
                                return <AgentToolBubble events={events} sessionId={activeSessionId} />;
                              }
                            } catch { /* ignore */ }
                            return null;
                          })()}
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as never}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        </>
                      )}
                    </Card>
                  </div>
                ))}

                {/* Streaming bubble */}
                {sending && (
                  <div className="flex gap-2 min-w-0">
                    <div className="shrink-0 w-7 h-7 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-violet-500" />
                    </div>
                    <Card className="px-4 py-2.5 bg-muted text-sm max-w-[80%] min-w-0 overflow-hidden">
                      {agentEvents.length > 0 && <AgentToolBubble events={agentEvents} sessionId={activeSessionId} isSending={sending} />}
                      {isStreaming && streamingContent ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as never}>
                            {streamingContent}
                          </ReactMarkdown>
                        </div>
                      ) : agentEvents.length === 0 ? (
                        <div className="flex items-center gap-2 text-violet-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-xs">Agent is thinking...</span>
                        </div>
                      ) : null}
                    </Card>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-4">
              <div className="max-w-3xl mx-auto">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={supportsTools === false ? "Current model does not support agent tools — switch model in Settings" : "Ask the agent to read, search, or update your sheets & documents..."}
                    className={cn("min-h-[44px] max-h-[160px] resize-none", "focus-visible:ring-violet-500")}
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
                      className={cn("shrink-0 h-[44px] w-[44px]", ACCENT.bgSolid, ACCENT.textFg, "hover:bg-violet-700 dark:hover:bg-violet-600")}
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
            <Bot className="h-10 w-10 mb-3 text-violet-400/40" />
            <p className="text-sm font-medium">No agent chat selected</p>
            <p className="text-xs mt-1 text-muted-foreground">
              Create a new agent chat to get started.
            </p>
            <p className="text-xs mt-3 max-w-[280px] text-center text-muted-foreground/70">
              The agent can read & write your Sheets and Documents.
              Use the <strong>Context</strong> button to choose what it can access.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
