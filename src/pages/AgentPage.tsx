import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import agentCrowner from "../assets/AgentCrowner_512.png";
import {
  Send, Bot, Loader2, Square,
  Wrench, ChevronDown, ChevronRight, Check,
  Table2, FileText, Settings2, XCircle, Play, AlertTriangle,
  BookOpen, Globe, FolderOpen,
} from "lucide-react";
import type { AgentEvent } from "../hooks/useFetchSSE";
import type { AgentScope } from "../contexts/ChatStreamContext";
import { useChatStream } from "../contexts/ChatStreamContext";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";
import { toast } from "../hooks/useToast";
import { useIsDark } from "../hooks/useIsDark";
import { useSidebarResize } from "../hooks/useSidebarResize";
import { createMarkdownComponents } from "../lib/markdownComponents";
import { SessionSidebar } from "../components/SessionSidebar";
import { RisoBackground } from "../components/RisoBackground";
import type { TuningParams } from "../components/AIControlPanel";
import type { ChatSession, ChatMessage, ScopeItem } from "../types/api";
import { open as tauriOpenDialog } from "@tauri-apps/plugin-dialog";
import { API_BASE } from "../lib/constants";
// ── Accent color utilities ─────────────────────────────────────────
// The agent page uses violet instead of the app's primary color.

interface AgentPageProps {
  tuningParams?: TuningParams;
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
    <div
      className="flex items-center gap-2 px-3 py-1 font-mono-ui text-[11px] font-medium rounded-md border animate-riso-pulse"
      style={{
        background: 'color-mix(in srgb, var(--accent-violet) 10%, transparent)',
        borderColor: 'color-mix(in srgb, var(--accent-violet) 30%, transparent)',
        color: 'var(--accent-violet)',
      }}
    >
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
  type ErrorStep = { kind: "error"; message: string };
  type ToolStep = { kind: "tool"; callId: string; tool: string; args: Record<string, unknown>; result?: string; durationMs?: number; finished: boolean; hasError: boolean; errorText?: string; isPreview: boolean; previewDesc?: string };
  type Step = ThinkingStep | ErrorStep | ToolStep;

  const steps: Step[] = [];
  const toolMap = new Map<string, ToolStep>();

  for (const evt of events) {
    if (evt.type === "thinking") {
      steps.push({ kind: "thinking", content: evt.content ?? "" });
    } else if (evt.type === "error") {
      steps.push({ kind: "error", message: evt.message ?? "Unknown error" });
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
            <div key={`t${i}`} className="font-mono-ui text-[11px] italic px-1 py-0.5 opacity-70" style={{ color: 'var(--accent-violet)' }}>
              {step.content}
            </div>
          );
        }
        if (step.kind === "error") {
          return (
            <div key={`e${i}`} className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/30 px-2.5 py-1.5 rounded-md">
              <XCircle className="h-3 w-3 shrink-0" />
              {step.message}
            </div>
          );
        }
        const key = step.callId;
        const isOpen = expanded[key] ?? false;
        const applyState = applyStates[key] ?? "idle";
        return (
          <div
            key={key}
            className="border rounded-md font-mono-ui text-xs"
            style={step.hasError
              ? { borderColor: 'rgba(220,38,38,0.30)', background: 'rgba(220,38,38,0.05)' }
              : { borderColor: 'color-mix(in srgb, var(--accent-violet) 20%, transparent)', background: 'color-mix(in srgb, var(--accent-violet) 5%, transparent)' }
            }
          >
            <button
              className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left transition-colors hover:bg-muted/60"
              onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
            >
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <Wrench className="h-3 w-3" style={{ color: 'var(--accent-violet)' }} />
              <span className="font-medium">{step.tool}</span>
              {step.finished ? (
                <span className="ml-auto flex items-center gap-1.5">
                  {step.durationMs != null && (
                    <span className="text-muted-foreground">{step.durationMs}ms</span>
                  )}
                  {step.hasError ? (
                    <XCircle className="h-3 w-3 text-red-500" />
                  ) : step.isPreview ? (
                    <span className="font-mono-ui text-[10px] font-medium" style={{ color: 'var(--accent-violet)' }}>Preview</span>
                  ) : (
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                  )}
                </span>
              ) : (
                <Loader2 className="h-3 w-3 animate-spin ml-auto" style={{ color: 'var(--accent-violet)' }} />
              )}
            </button>
            {isOpen && (
              <div className="px-2.5 pb-2 space-y-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-violet) 20%, transparent)' }}>
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
                    <span style={{ color: 'var(--accent-violet)' }}>{step.previewDesc}</span>
                    {applyState === "idle" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApply(step); }}
                        disabled={isSending}
                        className="btn-tactile btn-tactile-violet"
                        style={{ fontSize: 10, padding: '2px 7px' }}
                      >
                        <Play className="h-2.5 w-2.5" /> Apply
                      </button>
                    )}
                    {applyState === "applying" && (
                      <span className="inline-flex items-center gap-1 font-mono-ui text-[10px]" style={{ color: 'var(--accent-violet)' }}>
                        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Applying...
                      </span>
                    )}
                    {applyState === "applied" && (
                      <span className="inline-flex items-center gap-1 font-mono-ui text-[10px] text-green-600 dark:text-green-400 font-medium">
                        <Check className="h-2.5 w-2.5" /> Applied
                      </span>
                    )}
                    {applyState === "error" && (
                      <span className="font-mono-ui text-[10px] text-destructive">{applyErrors[key] ?? "Failed"}</span>
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
        <span className="riso-section-label">Agent Context</span>
        {totalSelected > 0 && (
          <button onClick={onClearAll} className="btn-tactile btn-tactile-outline" style={{ fontSize: 10, padding: '1px 6px' }}>
            Clear all
          </button>
        )}
      </div>

      {allSelected && (
        <div className="font-mono-ui text-[11px] font-medium" style={{ color: 'var(--accent-violet)' }}>
          All items selected — agent can access everything
        </div>
      )}

      {sheets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="riso-section-label">
              <Table2 className="h-3 w-3" /> Sheets
            </span>
            <button onClick={onSelectAllSheets} className="btn-tactile btn-tactile-outline" style={{ fontSize: 10, padding: '1px 6px' }}>
              {selectedSheetIds.size === sheets.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="space-y-0.5">
            {sheets.map(s => (
              <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer font-mono-ui text-xs transition-colors">
                <input
                  type="checkbox"
                  checked={selectedSheetIds.has(s.id)}
                  onChange={() => onToggleSheet(s.id)}
                  className="rounded border-muted-foreground"
                  style={{ accentColor: 'var(--accent-violet)' }}
                />
                <span className="truncate">{s.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="riso-section-label">
              <FileText className="h-3 w-3" /> Documents
            </span>
            <button onClick={onSelectAllDocuments} className="btn-tactile btn-tactile-outline" style={{ fontSize: 10, padding: '1px 6px' }}>
              {selectedDocumentIds.size === documents.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="space-y-0.5">
            {documents.map(d => (
              <label key={d.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer font-mono-ui text-xs transition-colors">
                <input
                  type="checkbox"
                  checked={selectedDocumentIds.has(d.id)}
                  onChange={() => onToggleDocument(d.id)}
                  className="rounded border-muted-foreground"
                  style={{ accentColor: 'var(--accent-violet)' }}
                />
                <span className="truncate">{d.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {sheets.length === 0 && documents.length === 0 && (
        <p className="font-mono-ui text-[11px] text-muted-foreground py-2">No sheets or documents yet. Create some first.</p>
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
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const { sidebarWidth, onResizeStart } = useSidebarResize();
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showKbPanel, setShowKbPanel] = useState(false);
  const kbPanelRef = useRef<HTMLDivElement>(null);

  // Knowledge Base state
  interface KbStatus { indexed: boolean; chunks: number; path: string | null; available: boolean }
  const [kbStatus, setKbStatus] = useState<KbStatus>({ indexed: false, chunks: 0, path: null, available: true });
  const [kbPath, setKbPath] = useState("");
  const [kbIndexing, setKbIndexing] = useState(false);
  const [kbError, setKbError] = useState<string | null>(null);

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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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
    }).catch(() => {
      setSupportsTools(false);
      setModelLabel("AI unavailable");
    });
  }, []);

  // Load scope items
  useEffect(() => {
    axios.get(`${API_BASE}/sheets`).then(r => {
      const items = (Array.isArray(r.data) ? r.data : []).map((s: { id: string; title: string }) => ({ id: s.id, title: s.title, type: "sheet" as const }));
      setAllSheets(items);
      setSelectedSheetIds(new Set(items.map((s: ScopeItem) => s.id)));
    }).catch(() => { setAllSheets([]); });
    axios.get(`${API_BASE}/documents`).then(r => {
      const docs = Array.isArray(r.data) ? r.data : r.data.documents ?? [];
      const items = docs.map((d: { id: string; title: string }) => ({ id: d.id, title: d.title, type: "document" as const }));
      setAllDocuments(items);
      setSelectedDocumentIds(new Set(items.map((d: ScopeItem) => d.id)));
    }).catch(() => { setAllDocuments([]); });
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
    requestAnimationFrame(() => {
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages, streamingContent, agentEvents]);

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

  // Close KB panel on outside click
  useEffect(() => {
    if (!showKbPanel) return;
    function onClickOutside(e: MouseEvent) {
      if (kbPanelRef.current && !kbPanelRef.current.contains(e.target as Node)) {
        setShowKbPanel(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showKbPanel]);

  // Fetch KB status on mount
  useEffect(() => {
    axios.get(`${API_BASE}/rag/status`).then(r => setKbStatus(r.data)).catch(() => { setKbStatus({ indexed: false, chunks: 0, path: null, available: false }); });
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
    } catch {
      toast("Failed to save title.", "error");
    }
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

  const markdownComponents = useMemo(() => createMarkdownComponents(isDark), [isDark]);

  const scopeCount = selectedSheetIds.size + selectedDocumentIds.size;
  const totalCount = allSheets.length + allDocuments.length;

  async function browseFolder() {
    try {
      const selected = await tauriOpenDialog({ directory: true, multiple: false });
      if (selected && typeof selected === "string") setKbPath(selected);
    } catch {
      // Not in Tauri context or dialog cancelled — ignore
    }
  }

  async function indexKnowledgeBase() {
    const path = kbPath.trim();
    if (!path) return;
    setKbIndexing(true);
    setKbError(null);
    try {
      const res = await axios.post(`${API_BASE}/rag/index`, { path });
      const updated = await axios.get(`${API_BASE}/rag/status`);
      setKbStatus(updated.data);
      toast(`Indexed ${res.data.indexed_chunks} chunks from ${path}`, "success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Indexing failed";
      setKbError(msg);
    } finally {
      setKbIndexing(false);
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <SessionSidebar
        accent="violet"
        icon={Bot}
        newLabel="New Agent Chat"
        sessionsLabel="Sessions"
        emptyLabel="No agent chats yet."
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
      <div className="relative flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden riso-noise">
        <RisoBackground accent="violet" variant="chat" />
        {activeSessionId ? (
          <>
            {/* Header */}
            <div className="h-14 shrink-0 border-b px-4 flex items-center gap-3" style={{ position: 'relative', zIndex: 1 }}>
              <div className="flex items-center gap-1.5 shrink-0">
                <Bot className="h-4 w-4" style={{ color: 'var(--accent-violet)' }} />
                <span className="font-display font-bold text-base riso-misreg-hover" style={{ color: 'var(--accent-violet)' }}>
                  {activeSession?.title ?? "Agent Mode"}
                </span>
              </div>

              <div className="flex-1" />

              {/* Context selector trigger */}
              <div className="relative" ref={contextPanelRef}>
                <button
                  onClick={() => setShowContextPanel(!showContextPanel)}
                  className={cn(
                    "btn-tactile",
                    showContextPanel ? "btn-tactile-violet" : "btn-tactile-outline"
                  )}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Context
                  <span className={cn(
                    "tag-riso",
                    scopeCount === totalCount ? "tag-riso-violet" : scopeCount === 0 ? "" : "tag-riso-violet"
                  )} style={{ fontSize: 9, padding: '0px 5px' }}>
                    {scopeCount === totalCount ? "All" : `${scopeCount}/${totalCount}`}
                  </span>
                </button>

                {showContextPanel && (
                  <div className="absolute top-full mt-1 right-0 z-50 bg-card border border-border-strong rounded-lg card-riso card-riso-violet p-3 min-w-[260px] max-h-[400px] overflow-y-auto">
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

              {/* Knowledge Base button + panel */}
              <div className="relative" ref={kbPanelRef}>
                <button
                  onClick={() => setShowKbPanel(!showKbPanel)}
                  className={cn(
                    "btn-tactile",
                    showKbPanel ? "btn-tactile-violet" : "btn-tactile-outline"
                  )}
                  title="Knowledge Base — index a folder for RAG search"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  KB
                  {kbStatus.indexed && (
                    <span className="tag-riso tag-riso-violet" style={{ fontSize: 9, padding: '0px 5px' }}>
                      {kbStatus.chunks}
                    </span>
                  )}
                </button>

                {showKbPanel && (
                  <div className="absolute top-full mt-1 right-0 z-50 bg-card border border-border-strong rounded-lg card-riso card-riso-violet p-4 w-[320px]">
                    <p className="riso-section-label mb-3">
                      <BookOpen className="h-3.5 w-3.5" />
                      Knowledge Base (RAG)
                    </p>
                    {kbStatus.indexed ? (
                      <div className="mb-3 font-mono-ui text-[11px] text-muted-foreground rounded px-3 py-2 border border-border-strong" style={{ background: 'color-mix(in srgb, var(--accent-violet) 6%, transparent)' }}>
                        <span className="font-medium" style={{ color: 'var(--accent-violet)' }}>{kbStatus.chunks} chunks indexed</span>
                        <br />
                        <span className="truncate block mt-0.5" title={kbStatus.path ?? ""}>{kbStatus.path}</span>
                      </div>
                    ) : (
                      <p className="font-mono-ui text-[11px] text-muted-foreground mb-3">No folder indexed yet. Select a folder to enable semantic search across your local files.</p>
                    )}
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="flex-1 font-mono-ui text-xs border border-border-strong rounded px-2 py-1.5 bg-background placeholder:text-muted-foreground focus:outline-none focus:border-accent-violet transition-colors"
                        style={{ '--tw-ring-color': 'var(--accent-violet)' } as React.CSSProperties}
                        placeholder="/path/to/folder"
                        value={kbPath}
                        onChange={e => setKbPath(e.target.value)}
                      />
                      <button
                        onClick={browseFolder}
                        className="btn-tactile btn-tactile-outline shrink-0 px-2"
                        title="Browse for folder"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {kbError && <p className="font-mono-ui text-[11px] text-destructive mb-2">{kbError}</p>}
                    <button
                      onClick={indexKnowledgeBase}
                      disabled={kbIndexing || !kbPath.trim()}
                      className="btn-tactile btn-tactile-violet w-full justify-center"
                    >
                      {kbIndexing ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" /> Indexing...
                        </>
                      ) : kbStatus.indexed ? "Re-index Folder" : "Index Folder"}
                    </button>
                    <p className="font-mono-ui text-[10px] text-muted-foreground mt-2">
                      Supports PDF, DOCX, TXT, MD. The agent will use <code>query_knowledge_base</code> automatically.
                    </p>
                  </div>
                )}
              </div>

              {/* Web Access badge */}
              <span
                className="btn-tactile btn-tactile-outline cursor-default"
                title="Web search is available — agent can use web_search and read_web_page tools"
              >
                <Globe className="h-3.5 w-3.5" />
                Web
              </span>

              {/* Status banner */}
              <AgentStatusBanner events={agentEvents} isSending={sending} isStreaming={isStreaming} />
            </div>

            {/* Tool support warning */}
            {supportsTools === false && (
              <div
                className="mx-4 mt-2 flex items-center gap-2 font-mono-ui text-[11px] px-3 py-2 rounded-md border"
                style={{ background: 'color-mix(in srgb, var(--accent-gold) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-gold) 30%, transparent)', color: 'var(--accent-gold)' }}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong>{modelLabel}</strong> does not support tool calling — the agent cannot read or write your data.
                  Switch to an HTTP engine or download a model tagged <strong>agent</strong> in Settings &gt; Model Gallery.
                </span>
              </div>
            )}

            {/* Scope warning — only show if user explicitly deselected everything */}
            {scopeCount === 0 && totalCount > 0 && supportsTools !== false && (
              <div className="mx-4 mt-2 flex items-center gap-2 font-mono-ui text-[11px] text-muted-foreground bg-muted/50 border border-border-strong px-3 py-2 rounded-md">
                Agent context is empty — it won't see any sheets or documents.
                <button
                  onClick={() => {
                    setSelectedSheetIds(new Set(allSheets.map(s => s.id)));
                    setSelectedDocumentIds(new Set(allDocuments.map(d => d.id)));
                  }}
                  className="underline hover:no-underline font-medium transition-colors hover:text-foreground"
                >
                  Select all
                </button>
              </div>
            )}

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4" style={{ position: 'relative', zIndex: 1 }}>
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex gap-2.5 animate-msg-in chat-msg-virtual", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
                  >
                    {/* Avatar */}
                    {msg.role === "assistant" ? (
                      <div
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center border"
                        style={{ background: 'color-mix(in srgb, var(--accent-violet) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-violet) 28%, transparent)' }}
                      >
                        <Bot className="h-4 w-4" style={{ color: 'var(--accent-violet)' }} />
                      </div>
                    ) : (
                      <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-lg leading-none bg-muted border border-border-strong">
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
                          ? "text-white card-riso card-riso-violet"
                          : "bg-card riso-bubble-ai-violet"
                      )}
                      style={msg.role === "user" ? { background: 'var(--accent-violet)' } : undefined}
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
                  <div className="flex gap-2.5 min-w-0">
                    <div
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center border"
                      style={{ background: 'color-mix(in srgb, var(--accent-violet) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-violet) 28%, transparent)' }}
                    >
                      <Bot className="h-4 w-4" style={{ color: 'var(--accent-violet)' }} />
                    </div>
                    <Card className="px-4 py-2.5 bg-card riso-bubble-ai-violet text-sm max-w-[80%] min-w-0 overflow-hidden">
                      {agentEvents.length > 0 && <AgentToolBubble events={agentEvents} sessionId={activeSessionId} isSending={sending} />}
                      {isStreaming && streamingContent ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as never}>
                            {streamingContent}
                          </ReactMarkdown>
                        </div>
                      ) : agentEvents.length === 0 ? (
                        <span className="inline-flex items-center gap-1.5 font-mono-ui text-[11px] animate-riso-pulse" style={{ color: 'var(--accent-violet)' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-violet)', display: 'inline-block' }} />
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-orange)', display: 'inline-block' }} className="animate-riso-pulse" />
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-teal)', display: 'inline-block' }} className="animate-riso-pulse" />
                          <span className="ml-1">Agent is thinking...</span>
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
              <div className="max-w-3xl mx-auto">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={supportsTools === false ? "Current model does not support agent tools — switch model in Settings" : "Ask the agent to read, search, or update your sheets & documents..."}
                    className="min-h-[44px] max-h-[160px] resize-none border-border-strong"
                    style={{ '--tw-ring-color': 'var(--accent-violet)' } as React.CSSProperties}
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
                      className="btn-tactile btn-tactile-violet shrink-0 h-[44px] w-[44px] justify-center"
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
            <div className="animate-crower-pulse" style={{ position: 'relative', zIndex: 1, width: 220, height: 220, borderRadius: '50%', overflow: 'hidden', background: '#0a0806', flexShrink: 0 }}>
              <img src={agentCrowner} alt="AgentCrowner" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              {/* light sweep overlay */}
              <div className="animate-crower-shine" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)', borderRadius: '50%' }} />
            </div>
            <div className="text-center space-y-2" style={{ position: 'relative', zIndex: 1 }}>
              <p className="font-mono-ui uppercase" style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--accent-violet)', opacity: 0.85 }}>Agent Crower</p>
              <h2
                className="font-display font-black tracking-tight leading-none"
                style={{ fontSize: 'clamp(2.8rem, 6vw, 4.2rem)', textShadow: '4px 4px 0 rgba(139,98,212,0.28), -2px -2px 0 rgba(224,78,14,0.18)', letterSpacing: '-0.02em', color: 'var(--accent-violet)' }}
              >
                Agent Mode
              </h2>
              <p className="text-sm text-muted-foreground text-center whitespace-nowrap">
                The agent can read &amp; write your Sheets and Documents.
              </p>
              <p className="font-mono-ui uppercase" style={{ fontSize: 12, letterSpacing: '0.12em', paddingLeft: '0.12em', color: 'var(--muted-foreground)', opacity: 0.7, whiteSpace: 'nowrap', textAlign: 'center' }}>
                Use Context to choose access
              </p>
            </div>
            <div className="flex items-center gap-2" style={{ position: 'relative', zIndex: 1 }}>
              <span style={{ width: 28, height: 5, borderRadius: 3, background: 'var(--accent-violet)', opacity: 0.75, display: 'block' }} />
              <span style={{ width: 28, height: 5, borderRadius: 3, background: 'var(--accent-orange)', opacity: 0.6, display: 'block' }} />
              <span style={{ width: 28, height: 5, borderRadius: 3, background: 'var(--accent-teal)', opacity: 0.6, display: 'block' }} />
            </div>
            <p className="riso-stamp text-center" style={{ position: 'relative', zIndex: 1, color: 'var(--accent-violet)', fontSize: 13 }}>Select or create a session</p>
          </div>
        )}
      </div>

    </div>
  );
}
