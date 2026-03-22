import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  Plus, Trash2, ZoomIn, ZoomOut, RotateCcw,
  MessageSquare, FileText, Table2,
  ExternalLink, X, ChevronRight, Loader2, StickyNote, Link2, Type, Copy, Maximize2, Magnet,
  Undo2, Redo2,
} from "lucide-react";
import { cn } from "../lib/utils";

const API_BASE = "http://127.0.0.1:8000";

// ─── Types ────────────────────────────────────────────────────────

interface Viewport { x: number; y: number; scale: number }

interface NoteData { text: string; color: "yellow" | "green" | "blue" | "pink" }
interface RefData { refType: "chat" | "document" | "sheet"; refId: string; title: string }
interface LabelData { text: string }

interface CanvasNode {
  id: string;
  type: "note" | "ref" | "label";
  x: number; y: number; w: number; h: number;
  data: NoteData | RefData | LabelData;
}
interface CanvasEdge { id: string; fromNode: string; toNode: string; label?: string }
interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Viewport;
}
interface CanvasMeta { id: string; title: string; created_at: string; updated_at: string }

// ─── Helpers ──────────────────────────────────────────────────────

function genId() { return Math.random().toString(36).slice(2, 11); }

const EMPTY_CANVAS: CanvasState = {
  nodes: [], edges: [], viewport: { x: 0, y: 0, scale: 1 },
};

const NOTE_RING: Record<NoteData["color"], string> = {
  yellow: "bg-yellow-50 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-700",
  green:  "bg-green-50  dark:bg-green-900/40  border-green-300  dark:border-green-700",
  blue:   "bg-blue-50   dark:bg-blue-900/40   border-blue-300   dark:border-blue-700",
  pink:   "bg-pink-50   dark:bg-pink-900/40   border-pink-300   dark:border-pink-700",
};
const NOTE_HEAD: Record<NoteData["color"], string> = {
  yellow: "bg-yellow-200/80 dark:bg-yellow-800/50",
  green:  "bg-green-200/80  dark:bg-green-800/50",
  blue:   "bg-blue-200/80   dark:bg-blue-800/50",
  pink:   "bg-pink-200/80   dark:bg-pink-800/50",
};
const COLOR_DOT: Record<NoteData["color"], string> = {
  yellow: "bg-yellow-400", green: "bg-green-400",
  blue: "bg-blue-400",     pink: "bg-pink-400",
};

// ─── Port (shared) ────────────────────────────────────────────────

function Port({ side, isWiring, onMouseDown }: {
  side: "in" | "out";
  isWiring: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={cn(
        "absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 bg-background z-10 transition-all cursor-crosshair",
        side === "in" ? "-left-3" : "-right-3",
        isWiring
          ? "border-primary bg-primary/30 scale-125"
          : "border-muted-foreground/30 hover:border-primary hover:scale-125 hover:bg-primary/20",
      )}
      onMouseDown={onMouseDown}
    />
  );
}

// ─── ResizeHandle ─────────────────────────────────────────────────

type ResizeHandlePos = "nw" | "ne" | "sw" | "se";

const RESIZE_CURSOR: Record<ResizeHandlePos, string> = {
  nw: "nw-resize", ne: "ne-resize", sw: "sw-resize", se: "se-resize",
};
const RESIZE_POS: Record<ResizeHandlePos, React.CSSProperties> = {
  nw: { top: -4, left: -4 },  ne: { top: -4, right: -4 },
  sw: { bottom: -4, left: -4 }, se: { bottom: -4, right: -4 },
};

function ResizeHandle({ pos, onMouseDown }: {
  pos: ResizeHandlePos;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      style={{
        position: "absolute", width: 8, height: 8, zIndex: 20,
        background: "hsl(var(--primary))", border: "2px solid white",
        borderRadius: 2, cursor: RESIZE_CURSOR[pos], ...RESIZE_POS[pos],
      }}
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e); }}
    />
  );
}

// ─── StickyNoteNode ───────────────────────────────────────────────

interface NodeProps {
  node: CanvasNode;
  selected: boolean;
  isWiring: boolean;
  onDragStart: (nodeId: string, e: React.MouseEvent) => void;
  onDelete: (nodeId: string) => void;
  onUpdate: (nodeId: string, data: Partial<NoteData | RefData>) => void;
  onPortMouseDown: (nodeId: string, side: "in" | "out", e: React.MouseEvent) => void;
  onNodeMouseDown: (nodeId: string, e: React.MouseEvent) => void;
  onNavigate?: (page: any, id?: string) => void;
  onResizeStart: (nodeId: string, handle: ResizeHandlePos, e: React.MouseEvent) => void;
  onEditStart?: (nodeId: string) => void;
  onContextMenu?: (nodeId: string, x: number, y: number) => void;
}

function StickyNoteNode({ node, selected, isWiring, onDragStart, onDelete, onUpdate, onPortMouseDown, onNodeMouseDown, onResizeStart, onEditStart, onContextMenu }: NodeProps) {
  const data = node.data as NoteData;
  return (
    <div
      className={cn(
        "absolute rounded-lg border-2 shadow-md flex flex-col",
        NOTE_RING[data.color],
        selected && "ring-2 ring-primary ring-offset-1",
      )}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onMouseDown={(e) => { e.stopPropagation(); onNodeMouseDown(node.id, e); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(node.id, e.clientX, e.clientY); }}
    >
      <div
        className={cn("flex items-center justify-between px-2 py-1 rounded-t-md cursor-grab shrink-0", NOTE_HEAD[data.color])}
        onMouseDown={(e) => { e.stopPropagation(); onDragStart(node.id, e); }}
      >
        <div className="flex gap-1">
          {(["yellow", "green", "blue", "pink"] as const).map((c) => (
            <button
              key={c}
              className={cn("w-3 h-3 rounded-full border border-black/10", COLOR_DOT[c], data.color === c && "ring-1 ring-foreground/60 scale-110")}
              onClick={(e) => { e.stopPropagation(); onUpdate(node.id, { color: c }); }}
            />
          ))}
        </div>
        <button className="text-muted-foreground hover:text-destructive p-0.5 rounded" onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}>
          <X size={11} />
        </button>
      </div>
      <textarea
        className="flex-1 p-2 text-sm bg-transparent resize-none outline-none rounded-b-md"
        value={data.text}
        onChange={(e) => onUpdate(node.id, { text: e.target.value })}
        placeholder="Write something…"
        onFocus={() => onEditStart?.(node.id)}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <Port side="in"  isWiring={isWiring} onMouseDown={(e) => { e.stopPropagation(); onPortMouseDown(node.id, "in", e); }} />
      <Port side="out" isWiring={isWiring} onMouseDown={(e) => { e.stopPropagation(); onPortMouseDown(node.id, "out", e); }} />
      {selected && (["nw","ne","sw","se"] as ResizeHandlePos[]).map(pos => (
        <ResizeHandle key={pos} pos={pos} onMouseDown={(e) => onResizeStart(node.id, pos, e)} />
      ))}
    </div>
  );
}

// ─── ReferenceCardNode ────────────────────────────────────────────

const REF_ICON = { chat: MessageSquare, document: FileText, sheet: Table2 } as const;
const REF_COLOR = { chat: "text-violet-500", document: "text-blue-500", sheet: "text-emerald-500" } as const;
const REF_PAGE_MAP = { chat: "chat", document: "documents", sheet: "sheets" } as const;

function ReferenceCardNode({ node, selected, isWiring, onDragStart, onDelete, onPortMouseDown, onNodeMouseDown, onNavigate, onResizeStart, onContextMenu }: NodeProps) {
  const data = node.data as RefData;
  const Icon = REF_ICON[data.refType];
  const color = REF_COLOR[data.refType];
  return (
    <div
      className={cn(
        "absolute rounded-lg border-2 border-border bg-background shadow-md flex flex-col",
        selected && "ring-2 ring-primary ring-offset-1",
      )}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onMouseDown={(e) => { e.stopPropagation(); onNodeMouseDown(node.id, e); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(node.id, e.clientX, e.clientY); }}
    >
      <div
        className="flex items-center justify-between px-2.5 py-1.5 border-b bg-muted/50 rounded-t-md cursor-grab shrink-0"
        onMouseDown={(e) => { e.stopPropagation(); onDragStart(node.id, e); }}
      >
        <div className="flex items-center gap-1.5">
          <Icon size={12} className={color} />
          <span className={cn("text-[10px] font-bold uppercase tracking-wider", color)}>
            {data.refType}
          </span>
        </div>
        <button className="text-muted-foreground hover:text-destructive p-0.5 rounded" onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}>
          <X size={11} />
        </button>
      </div>
      <div className="flex-1 flex flex-col justify-between p-2.5 gap-1.5 min-h-0">
        <p className="text-sm font-medium leading-tight line-clamp-2">{data.title}</p>
        <button
          className="flex items-center gap-1 text-xs text-primary hover:underline w-fit"
          onClick={(e) => { e.stopPropagation(); onNavigate?.(REF_PAGE_MAP[data.refType], data.refId); }}
        >
          <ExternalLink size={11} />
          Open
        </button>
      </div>
      <Port side="in"  isWiring={isWiring} onMouseDown={(e) => { e.stopPropagation(); onPortMouseDown(node.id, "in", e); }} />
      <Port side="out" isWiring={isWiring} onMouseDown={(e) => { e.stopPropagation(); onPortMouseDown(node.id, "out", e); }} />
      {selected && (["nw","ne","sw","se"] as ResizeHandlePos[]).map(pos => (
        <ResizeHandle key={pos} pos={pos} onMouseDown={(e) => onResizeStart(node.id, pos, e)} />
      ))}
    </div>
  );
}

// ─── TextLabelNode ────────────────────────────────────────────────

function TextLabelNode({ node, selected, onDragStart, onUpdate, onNodeMouseDown, onResizeStart, onEditStart, onContextMenu }: NodeProps) {
  const data = node.data as LabelData;
  const [editing, setEditing] = useState(false);
  return (
    <div
      className={cn(
        "absolute flex items-center justify-center cursor-grab",
        selected && "ring-2 ring-primary ring-offset-1 rounded",
      )}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onMouseDown={(e) => { e.stopPropagation(); onNodeMouseDown(node.id, e); if (!editing) onDragStart(node.id, e); }}
      onDoubleClick={() => { onEditStart?.(node.id); setEditing(true); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(node.id, e.clientX, e.clientY); }}
    >
      {editing ? (
        <textarea
          autoFocus
          className="w-full h-full resize-none bg-transparent text-center text-sm outline-none"
          value={data.text}
          onChange={(e) => onUpdate(node.id, { text: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === "Escape") { setEditing(false); } e.stopPropagation(); }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : (
        <p className="text-sm text-foreground/70 select-none text-center whitespace-pre-wrap px-1 leading-snug">
          {data.text || <span className="italic text-muted-foreground/40 text-xs">double-click to edit</span>}
        </p>
      )}
      {selected && (["nw","ne","sw","se"] as ResizeHandlePos[]).map(pos => (
        <ResizeHandle key={pos} pos={pos} onMouseDown={(e) => onResizeStart(node.id, pos, e)} />
      ))}
    </div>
  );
}

// ─── Add Reference dialog ─────────────────────────────────────────

interface RefItem { id: string; title: string; type: "chat" | "document" | "sheet" }

function AddRefDialog({ onAdd, onClose }: { onAdd: (item: RefItem) => void; onClose: () => void }) {
  const [items, setItems] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "chat" | "document" | "sheet">("all");

  useEffect(() => {
    Promise.all([
      axios.get(`${API_BASE}/chat/sessions`),
      axios.get(`${API_BASE}/documents`),
      axios.get(`${API_BASE}/sheets`),
    ]).then(([chats, docs, sheets]) => {
      setItems([
        ...(chats.data || []).map((c: any) => ({ id: String(c.id), title: c.title || "Untitled Chat", type: "chat" as const })),
        ...(docs.data  || []).map((d: any) => ({ id: d.id, title: d.title || "Untitled", type: "document" as const })),
        ...(sheets.data|| []).map((s: any) => ({ id: s.id, title: s.title || "Untitled Sheet", type: "sheet" as const })),
      ]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const visible = filter === "all" ? items : items.filter(i => i.type === filter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-96 bg-background border rounded-xl shadow-xl flex flex-col overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Add Reference Card</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="flex gap-1 px-4 pt-3">
          {(["all", "chat", "document", "sheet"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}>
              {f === "all" ? "All" : f === "chat" ? "Chats" : f === "document" ? "Docs" : "Sheets"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto max-h-72 p-2 space-y-0.5 mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Nothing found</p>
          ) : visible.map(item => {
            const Icon = REF_ICON[item.type];
            const color = REF_COLOR[item.type];
            return (
              <button
                key={`${item.type}-${item.id}`}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                onClick={() => onAdd(item)}
              >
                <Icon size={14} className={color} />
                <span className="text-sm truncate flex-1">{item.title}</span>
                <ChevronRight size={13} className="text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── CanvasPage ───────────────────────────────────────────────────

export function CanvasPage({ onNavigate }: { onNavigate?: (page: any, id?: string) => void }) {
  const [canvases, setCanvases] = useState<CanvasMeta[]>([]);
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
  const [canvasState, setCanvasState] = useState<CanvasState>(EMPTY_CANVAS);
  const [selected, setSelected] = useState<string | null>(null);
  const [wiringFrom, setWiringFrom] = useState<{ nodeId: string; px: number; py: number } | null>(null);
  const [wirePos,    setWirePos]    = useState<{ x: number; y: number } | null>(null);
  const [addRefOpen, setAddRefOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [historyLen, setHistoryLen] = useState(0);
  const [futureLen,  setFutureLen]  = useState(0);
  const [editingEdgeId,    setEditingEdgeId]    = useState<string | null>(null);
  const [editingEdgeLabel, setEditingEdgeLabel] = useState("");
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);

  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const canvasStateRef = useRef(canvasState);
  canvasStateRef.current = canvasState;
  const snapToGridRef = useRef(false);
  snapToGridRef.current = snapToGrid;
  const activeIdRef = useRef(activeCanvasId);
  activeIdRef.current = activeCanvasId;

  const wiringFromRef    = useRef<{ nodeId: string; px: number; py: number } | null>(null);
  wiringFromRef.current  = wiringFrom;

  const isPanning = useRef(false);
  const panStart = useRef({ mx: 0, my: 0, vpX: 0, vpY: 0 });
  const isDraggingNode = useRef(false);
  const dragState = useRef<{ nodeId: string; smx: number; smy: number; snx: number; sny: number } | null>(null);
  const isResizing = useRef(false);
  const resizeState = useRef<{
    nodeId: string; handle: ResizeHandlePos;
    smx: number; smy: number;
    snx: number; sny: number; snw: number; snh: number;
  } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef      = useRef<CanvasState[]>([]);
  const futureRef       = useRef<CanvasState[]>([]);
  const preDragStateRef = useRef<CanvasState | null>(null);
  const editingNodeRef  = useRef<string | null>(null);
  const MAX_HISTORY = 50;

  // ── Autosave ──────────────────────────────────────────────────────
  const scheduleAutoSave = useCallback((state: CanvasState, id: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaving(true);
      axios.put(`${API_BASE}/canvases/${id}`, { canvas_json: state })
        .catch(() => {})
        .finally(() => setSaving(false));
    }, 800);
  }, []);

  const updateCanvas = useCallback((updater: (prev: CanvasState) => CanvasState) => {
    setCanvasState(prev => {
      const next = updater(prev);
      if (activeIdRef.current) scheduleAutoSave(next, activeIdRef.current);
      return next;
    });
  }, [scheduleAutoSave]);

  // ── History ───────────────────────────────────────────────────────
  function pushHistory(state: CanvasState) {
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), state];
    futureRef.current  = [];
    editingNodeRef.current = null;
    setHistoryLen(historyRef.current.length);
    setFutureLen(0);
  }

  function undo() {
    if (!historyRef.current.length) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current  = [canvasStateRef.current, ...futureRef.current.slice(0, MAX_HISTORY - 1)];
    setHistoryLen(historyRef.current.length);
    setFutureLen(futureRef.current.length);
    updateCanvas(() => prev);
  }

  function redo() {
    if (!futureRef.current.length) return;
    const next = futureRef.current[0];
    futureRef.current  = futureRef.current.slice(1);
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), canvasStateRef.current];
    setHistoryLen(historyRef.current.length);
    setFutureLen(futureRef.current.length);
    updateCanvas(() => next);
  }

  function handleEditStart(nodeId: string) {
    if (editingNodeRef.current === nodeId) return;
    pushHistory(canvasStateRef.current);
    editingNodeRef.current = nodeId;
  }

  // ── Load canvases ─────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API_BASE}/canvases`).then(r => {
      setCanvases(r.data);
      if (r.data.length > 0) loadCanvas(r.data[0].id);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadCanvas(id: string) {
    axios.get(`${API_BASE}/canvases/${id}`).then(r => {
      setActiveCanvasId(id);
      const cs = r.data.canvas_json || EMPTY_CANVAS;
      setCanvasState({
        nodes: cs.nodes || [],
        edges: cs.edges || [],
        viewport: cs.viewport || { x: 0, y: 0, scale: 1 },
      });
      setSelected(null);
      setWiringFrom(null);
      setWirePos(null);
    }).catch(() => {});
  }

  async function createCanvas() {
    try {
      const r = await axios.post(`${API_BASE}/canvases`, { title: "Untitled Canvas" });
      setCanvases(prev => [r.data, ...prev]);
      loadCanvas(r.data.id);
    } catch { /* ignore */ }
  }

  async function renameCanvas(id: string, title: string) {
    const t = title.trim() || "Untitled Canvas";
    try { await axios.put(`${API_BASE}/canvases/${id}`, { title: t }); } catch { /* ignore */ }
    setCanvases(prev => prev.map(c => c.id === id ? { ...c, title: t } : c));
    setEditingCanvasId(null);
  }

  async function deleteCanvas(id: string) {
    try { await axios.delete(`${API_BASE}/canvases/${id}`); } catch { /* ignore */ }
    setCanvases(prev => {
      const updated = prev.filter(c => c.id !== id);
      if (activeIdRef.current === id) {
        if (updated.length > 0) loadCanvas(updated[0].id);
        else { setActiveCanvasId(null); setCanvasState(EMPTY_CANVAS); }
      }
      return updated;
    });
  }

  // ── Node helpers ──────────────────────────────────────────────────
  function getCenter() {
    const vp = canvasStateRef.current.viewport;
    const area = canvasAreaRef.current;
    return {
      cx: area ? (area.clientWidth  / 2 - vp.x) / vp.scale : 300,
      cy: area ? (area.clientHeight / 2 - vp.y) / vp.scale : 200,
    };
  }

  function addStickyNote() {
    if (!activeIdRef.current) return;
    pushHistory(canvasStateRef.current);
    const { cx, cy } = getCenter();
    const node: CanvasNode = {
      id: genId(), type: "note",
      x: cx - 100, y: cy - 75, w: 200, h: 150,
      data: { text: "", color: "yellow" },
    };
    updateCanvas(prev => ({ ...prev, nodes: [...prev.nodes, node] }));
    setSelected(node.id);
  }

  function addLabelNode() {
    if (!activeIdRef.current) return;
    pushHistory(canvasStateRef.current);
    const { cx, cy } = getCenter();
    const node: CanvasNode = {
      id: genId(), type: "label",
      x: cx - 90, y: cy - 24, w: 180, h: 48,
      data: { text: "Label" } as LabelData,
    };
    updateCanvas(prev => ({ ...prev, nodes: [...prev.nodes, node] }));
    setSelected(node.id);
  }

  function addRefCard(item: RefItem) {
    if (!activeIdRef.current) return;
    pushHistory(canvasStateRef.current);
    const { cx, cy } = getCenter();
    const node: CanvasNode = {
      id: genId(), type: "ref",
      x: cx - 110, y: cy - 50, w: 220, h: 100,
      data: { refType: item.type, refId: item.id, title: item.title },
    };
    updateCanvas(prev => ({ ...prev, nodes: [...prev.nodes, node] }));
    setAddRefOpen(false);
    setSelected(node.id);
  }

  function deleteNode(nodeId: string) {
    pushHistory(canvasStateRef.current);
    updateCanvas(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      edges: prev.edges.filter(e => e.fromNode !== nodeId && e.toNode !== nodeId),
    }));
    setSelected(s => s === nodeId ? null : s);
  }

  function duplicateNode(nodeId: string) {
    const node = canvasStateRef.current.nodes.find(n => n.id === nodeId);
    if (!node) return;
    pushHistory(canvasStateRef.current);
    const newNode: CanvasNode = {
      ...node, id: genId(), x: node.x + 24, y: node.y + 24,
      data: { ...node.data } as NoteData | RefData | LabelData,
    };
    updateCanvas(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    setSelected(newNode.id);
  }

  function updateNodeData(nodeId: string, patch: Partial<NoteData | RefData>) {
    if (!('text' in patch)) pushHistory(canvasStateRef.current);
    updateCanvas(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } as NoteData | RefData } : n
      ),
    }));
  }

  // ── Connections (drag-to-connect) ─────────────────────────────────
  function handlePortMouseDown(nodeId: string, side: "in" | "out", e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const node = canvasStateRef.current.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const px = side === "out" ? node.x + node.w : node.x;
    const py = node.y + node.h / 2;
    const wf = { nodeId, px, py };
    wiringFromRef.current = wf;
    setWiringFrom(wf);
    setWirePos({ x: px, y: py });
  }

  // Fallback: detect port proximity from the node's own mousedown (in case the small port div
  // doesn't receive the event in the Tauri webview)
  function onNodeMouseDown(nodeId: string, e: React.MouseEvent) {
    const node = canvasStateRef.current.nodes.find(n => n.id === nodeId);
    if (!node) { setSelected(nodeId); return; }
    const rect = canvasAreaRef.current?.getBoundingClientRect();
    if (!rect) { setSelected(nodeId); return; }
    const vp = canvasStateRef.current.viewport;
    const mx = (e.clientX - rect.left - vp.x) / vp.scale;
    const my = (e.clientY - rect.top  - vp.y) / vp.scale;
    const py = node.y + node.h / 2;
    const HIT_R = 18; // canvas-space hit radius (generous to cover port + its surroundings)
    if (Math.hypot(mx - node.x, my - py) < HIT_R) {
      handlePortMouseDown(nodeId, "in", e);
    } else if (Math.hypot(mx - (node.x + node.w), my - py) < HIT_R) {
      handlePortMouseDown(nodeId, "out", e);
    } else {
      setSelected(nodeId);
    }
  }

  function deleteEdge(edgeId: string) {
    pushHistory(canvasStateRef.current);
    updateCanvas(prev => ({ ...prev, edges: prev.edges.filter(e => e.id !== edgeId) }));
  }

  function saveEdgeLabel(edgeId: string, label: string) {
    pushHistory(canvasStateRef.current);
    updateCanvas(prev => ({
      ...prev,
      edges: prev.edges.map(e => e.id === edgeId ? { ...e, label: label.trim() || undefined } : e),
    }));
    setEditingEdgeId(null);
  }

  function handleNodeContextMenu(nodeId: string, x: number, y: number) {
    setSelected(nodeId);
    setContextMenu({ nodeId, x, y });
  }

  // ── Node drag ─────────────────────────────────────────────────────
  function handleNodeDragStart(nodeId: string, e: React.MouseEvent) {
    preDragStateRef.current = canvasStateRef.current;
    isDraggingNode.current = true;
    const node = canvasStateRef.current.nodes.find(n => n.id === nodeId)!;
    dragState.current = { nodeId, smx: e.clientX, smy: e.clientY, snx: node.x, sny: node.y };
    setSelected(nodeId);
  }

  // ── Node resize ───────────────────────────────────────────────────
  function handleNodeResizeStart(nodeId: string, handle: ResizeHandlePos, e: React.MouseEvent) {
    preDragStateRef.current = canvasStateRef.current;
    isResizing.current = true;
    const node = canvasStateRef.current.nodes.find(n => n.id === nodeId)!;
    resizeState.current = {
      nodeId, handle,
      smx: e.clientX, smy: e.clientY,
      snx: node.x, sny: node.y, snw: node.w, snh: node.h,
    };
  }

  // ── Canvas pan ────────────────────────────────────────────────────
  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    setSelected(null);
    setContextMenu(null);
    isPanning.current = true;
    const vp = canvasStateRef.current.viewport;
    panStart.current = { mx: e.clientX, my: e.clientY, vpX: vp.x, vpY: vp.y };
  }

  useEffect(() => {
    const GRID = 24;
    const snap = (v: number) => Math.round(v / GRID) * GRID;
    function onMouseMove(e: MouseEvent) {
      if (wiringFromRef.current) {
        const canvasRect = canvasAreaRef.current?.getBoundingClientRect();
        if (canvasRect) {
          const vp = canvasStateRef.current.viewport;
          const mx = (e.clientX - canvasRect.left - vp.x) / vp.scale;
          const my = (e.clientY - canvasRect.top  - vp.y) / vp.scale;
          setWirePos({ x: mx, y: my });
        }
        return; // don't do drag/pan while wiring
      }
      if (isDraggingNode.current && dragState.current) {
        const { nodeId, smx, smy, snx, sny } = dragState.current;
        const scale = canvasStateRef.current.viewport.scale;
        const dx = (e.clientX - smx) / scale;
        const dy = (e.clientY - smy) / scale;
        let nx = snx + dx, ny = sny + dy;
        if (snapToGridRef.current) { nx = snap(nx); ny = snap(ny); }
        updateCanvas(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, x: nx, y: ny } : n),
        }));
      } else if (isResizing.current && resizeState.current) {
        const { nodeId, handle, smx, smy, snx, sny, snw, snh } = resizeState.current;
        const scale = canvasStateRef.current.viewport.scale;
        const dx = (e.clientX - smx) / scale;
        const dy = (e.clientY - smy) / scale;
        const MIN_W = 80, MIN_H = 40;
        let newX = snx, newY = sny, newW = snw, newH = snh;
        if (handle === "se") { newW = Math.max(MIN_W, snw + dx); newH = Math.max(MIN_H, snh + dy); }
        if (handle === "sw") { newW = Math.max(MIN_W, snw - dx); newX = snx + (snw - newW); newH = Math.max(MIN_H, snh + dy); }
        if (handle === "ne") { newW = Math.max(MIN_W, snw + dx); newH = Math.max(MIN_H, snh - dy); newY = sny + (snh - newH); }
        if (handle === "nw") { newW = Math.max(MIN_W, snw - dx); newX = snx + (snw - newW); newH = Math.max(MIN_H, snh - dy); newY = sny + (snh - newH); }
        if (snapToGridRef.current) {
          newX = snap(newX); newY = snap(newY);
          newW = Math.max(MIN_W, snap(newW)); newH = Math.max(MIN_H, snap(newH));
        }
        updateCanvas(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, x: newX, y: newY, w: newW, h: newH } : n),
        }));
      } else if (isPanning.current) {
        const dx = e.clientX - panStart.current.mx;
        const dy = e.clientY - panStart.current.my;
        updateCanvas(prev => ({
          ...prev,
          viewport: { ...prev.viewport, x: panStart.current.vpX + dx, y: panStart.current.vpY + dy },
        }));
      }
    }
    const HIT_R = 22; // canvas-space proximity radius for completing a connection
    function onMouseUp(e: MouseEvent) {
      if (wiringFromRef.current) {
        const wf = wiringFromRef.current;
        const canvasRect = canvasAreaRef.current?.getBoundingClientRect();
        if (canvasRect) {
          const vp = canvasStateRef.current.viewport;
          const mx = (e.clientX - canvasRect.left - vp.x) / vp.scale;
          const my = (e.clientY - canvasRect.top  - vp.y) / vp.scale;
          for (const node of canvasStateRef.current.nodes) {
            if (node.id === wf.nodeId) continue;
            const py = node.y + node.h / 2;
            if (
              Math.hypot(mx - node.x, my - py) < HIT_R ||
              Math.hypot(mx - (node.x + node.w), my - py) < HIT_R
            ) {
              const exists = canvasStateRef.current.edges.some(
                ed => ed.fromNode === wf.nodeId && ed.toNode === node.id,
              );
              if (!exists) {
                pushHistory(canvasStateRef.current);
                updateCanvas(prev => ({
                  ...prev,
                  edges: [...prev.edges, { id: genId(), fromNode: wf.nodeId, toNode: node.id }],
                }));
              }
              break;
            }
          }
        }
        wiringFromRef.current = null;
        setWiringFrom(null);
        setWirePos(null);
      }
      if ((isDraggingNode.current || isResizing.current) && preDragStateRef.current) {
        pushHistory(preDragStateRef.current);
        preDragStateRef.current = null;
      }
      isDraggingNode.current = false;
      isPanning.current = false;
      isResizing.current = false;
      dragState.current = null;
      resizeState.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [updateCanvas]);

  // ── Zoom ──────────────────────────────────────────────────────────
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const area = canvasAreaRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const vp = canvasStateRef.current.viewport;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(3, Math.max(0.15, vp.scale * factor));
    const newX = mx - (mx - vp.x) * (newScale / vp.scale);
    const newY = my - (my - vp.y) * (newScale / vp.scale);
    updateCanvas(prev => ({ ...prev, viewport: { x: newX, y: newY, scale: newScale } }));
  }

  function zoomBy(factor: number) {
    updateCanvas(prev => ({
      ...prev,
      viewport: { ...prev.viewport, scale: Math.min(3, Math.max(0.15, prev.viewport.scale * factor)) },
    }));
  }

  function resetView() {
    updateCanvas(prev => ({ ...prev, viewport: { x: 0, y: 0, scale: 1 } }));
  }

  function zoomToFit() {
    const nodes = canvasStateRef.current.nodes;
    if (nodes.length === 0) return;
    const area = canvasAreaRef.current;
    if (!area) return;
    const pad = 60;
    const minX = Math.min(...nodes.map(n => n.x)) - pad;
    const minY = Math.min(...nodes.map(n => n.y)) - pad;
    const maxX = Math.max(...nodes.map(n => n.x + n.w)) + pad;
    const maxY = Math.max(...nodes.map(n => n.y + n.h)) + pad;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const scale = Math.min(area.clientWidth / contentW, area.clientHeight / contentH, 2);
    const x = area.clientWidth  / 2 - (minX + contentW / 2) * scale;
    const y = area.clientHeight / 2 - (minY + contentH / 2) * scale;
    updateCanvas(prev => ({ ...prev, viewport: { x, y, scale } }));
  }

  // ── SVG edge path ─────────────────────────────────────────────────
  function edgePath(from: CanvasNode, to: CanvasNode) {
    const x1 = from.x + from.w, y1 = from.y + from.h / 2;
    const x2 = to.x,             y2 = to.y   + to.h   / 2;
    const cx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  }

  const vp = canvasState.viewport;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Canvas list sidebar ──────────────────────────────────── */}
      <aside className="w-48 shrink-0 border-r bg-background flex flex-col overflow-hidden">
        <div className="p-3 border-b shrink-0">
          <button
            onClick={createCanvas}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} />
            New Canvas
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {canvases.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6 px-2">No canvases yet</p>
          )}
          {canvases.map(c => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors",
                activeCanvasId === c.id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => { if (editingCanvasId !== c.id) loadCanvas(c.id); }}
            >
              {editingCanvasId === c.id ? (
                <input
                  autoFocus
                  className="flex-1 text-xs bg-transparent border-b border-primary outline-none min-w-0"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => renameCanvas(c.id, editingTitle)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameCanvas(c.id, editingTitle);
                    if (e.key === "Escape") setEditingCanvasId(null);
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="flex-1 truncate text-xs"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingCanvasId(c.id);
                    setEditingTitle(c.title);
                  }}
                >
                  {c.title}
                </span>
              )}
              {editingCanvasId !== c.id && (
                <button
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  onClick={(e) => { e.stopPropagation(); deleteCanvas(c.id); }}
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Canvas main ───────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="h-10 shrink-0 border-b bg-background flex items-center gap-0.5 px-3">
          <button
            onClick={addStickyNote}
            disabled={!activeCanvasId}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <StickyNote size={13} />
            Note
          </button>
          <button
            onClick={addLabelNode}
            disabled={!activeCanvasId}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Type size={13} />
            Text
          </button>
          <button
            onClick={() => setAddRefOpen(true)}
            disabled={!activeCanvasId}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Link2 size={13} />
            Reference
          </button>
          {selected && (
            <>
              <button
                onClick={() => duplicateNode(selected)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Copy size={13} />
                Duplicate
              </button>
              <button
                onClick={() => deleteNode(selected)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </>
          )}
          <div className="flex-1" />
          {wiringFrom && (
            <span className="text-xs text-primary animate-pulse mr-2 select-none">
              Drag to a port… (Esc to cancel)
            </span>
          )}
          {saving && <span className="text-xs text-muted-foreground mr-2 select-none">Saving…</span>}
          <button
            onClick={undo}
            disabled={historyLen === 0}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={redo}
            disabled={futureLen === 0}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={14} />
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            onClick={() => setSnapToGrid(v => !v)}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              snapToGrid
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
            title={snapToGrid ? "Snap to grid: ON" : "Snap to grid: OFF"}
          >
            <Magnet size={14} />
          </button>
          <button
            onClick={zoomToFit}
            disabled={canvasState.nodes.length === 0}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
            title="Zoom to fit all nodes"
          >
            <Maximize2 size={14} />
          </button>
          <button onClick={() => zoomBy(1 / 1.2)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors" title="Zoom out">
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-muted-foreground w-10 text-center select-none tabular-nums">
            {Math.round(vp.scale * 100)}%
          </span>
          <button onClick={() => zoomBy(1.2)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors" title="Zoom in">
            <ZoomIn size={14} />
          </button>
          <button onClick={resetView} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors" title="Reset view">
            <RotateCcw size={14} />
          </button>
        </div>

        {/* Canvas area */}
        {!activeCanvasId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground select-none">
            <p className="text-sm">Create a canvas to get started</p>
            <button
              onClick={createCanvas}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus size={14} />
              New Canvas
            </button>
          </div>
        ) : (
          <div
            ref={canvasAreaRef}
            className={cn(
              "flex-1 overflow-hidden relative select-none",
              "bg-[radial-gradient(circle,_hsl(var(--muted-foreground)/0.12)_1px,_transparent_1px)]",
              "bg-[length:24px_24px]",
              wiringFrom ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
            )}
            onMouseDown={handleCanvasMouseDown}
            onWheel={handleWheel}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setWiringFrom(null); setWirePos(null); setContextMenu(null); }
              const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
              if ((e.key === "Delete" || e.key === "Backspace") && selected && !isTyping) {
                e.preventDefault();
                deleteNode(selected);
              }
              if ((e.key === "d" || e.key === "D") && (e.ctrlKey || e.metaKey) && selected && !isTyping) {
                e.preventDefault();
                duplicateNode(selected);
              }
              if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey) && !isTyping) {
                e.preventDefault();
                e.shiftKey ? redo() : undo();
              }
              if ((e.key === "y" || e.key === "Y") && (e.ctrlKey || e.metaKey) && !isTyping) {
                e.preventDefault();
                redo();
              }
              if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key) && selected && !isTyping) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
                const dy = e.key === "ArrowUp"   ? -step : e.key === "ArrowDown"  ? step : 0;
                pushHistory(canvasStateRef.current);
                updateCanvas(prev => ({
                  ...prev,
                  nodes: prev.nodes.map(n => n.id === selected ? { ...n, x: n.x + dx, y: n.y + dy } : n),
                }));
              }
            }}
            tabIndex={0}
          >
            <div
              style={{
                transform: `translate(${vp.x}px,${vp.y}px) scale(${vp.scale})`,
                transformOrigin: "0 0",
                position: "absolute",
                top: 0, left: 0,
                width: 0, height: 0,
              }}
            >
              {/* SVG edge layer */}
              <svg
                style={{
                  position: "absolute", top: 0, left: 0,
                  width: 0, height: 0, overflow: "visible",
                  pointerEvents: "none",
                }}
              >
                {/* Wiring preview line */}
                {wiringFrom && wirePos && (() => {
                  const cx = (wiringFrom.px + wirePos.x) / 2;
                  const d  = `M ${wiringFrom.px} ${wiringFrom.py} C ${cx} ${wiringFrom.py}, ${cx} ${wirePos.y}, ${wirePos.x} ${wirePos.y}`;
                  return (
                    <path d={d} fill="none"
                      stroke="hsl(var(--primary))" strokeOpacity={0.7}
                      strokeWidth={Math.max(1, 2 / vp.scale)}
                      strokeDasharray={`${6 / vp.scale} ${3 / vp.scale}`}
                    />
                  );
                })()}
                {canvasState.edges.map(edge => {
                  const fn = canvasState.nodes.find(n => n.id === edge.fromNode);
                  const tn = canvasState.nodes.find(n => n.id === edge.toNode);
                  if (!fn || !tn) return null;
                  const ox = fn.x + fn.w, oy = fn.y + fn.h / 2;
                  const ix = tn.x,        iy = tn.y + tn.h / 2;
                  const mx = (ox + ix) / 2;
                  const my = (oy + iy) / 2;
                  return (
                    <g key={edge.id}>
                      <path
                        d={edgePath(fn, tn)}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth={Math.max(1, 2 / vp.scale)}
                        strokeOpacity={0.65}
                        style={{ pointerEvents: "stroke", cursor: "pointer" }}
                        onClick={() => deleteEdge(edge.id)}
                      />
                      {editingEdgeId === edge.id ? (
                        <foreignObject x={mx - 52} y={my - 13} width={104} height={26} style={{ overflow: "visible" }}>
                          <input
                            autoFocus
                            className="w-full text-xs text-center bg-background border border-primary rounded px-1 outline-none"
                            style={{ height: 24 }}
                            value={editingEdgeLabel}
                            onChange={e => setEditingEdgeLabel(e.target.value)}
                            onBlur={() => saveEdgeLabel(edge.id, editingEdgeLabel)}
                            onKeyDown={e => {
                              if (e.key === "Enter") saveEdgeLabel(edge.id, editingEdgeLabel);
                              if (e.key === "Escape") setEditingEdgeId(null);
                              e.stopPropagation();
                            }}
                          />
                        </foreignObject>
                      ) : edge.label ? (
                        <>
                          <rect
                            x={mx - edge.label.length * 3.5} y={my - 9}
                            width={edge.label.length * 7} height={16}
                            fill="hsl(var(--background))" rx={3}
                          />
                          <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle"
                            fontSize={11} fill="hsl(var(--foreground))"
                            className="select-none pointer-events-none">
                            {edge.label}
                          </text>
                        </>
                      ) : null}
                      <circle
                        cx={mx} cy={my} r={8}
                        fill="transparent"
                        style={{ cursor: "text", pointerEvents: "all" }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingEdgeId(edge.id);
                          setEditingEdgeLabel(edge.label ?? "");
                        }}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Nodes */}
              {canvasState.nodes.map(node =>
                node.type === "note" ? (
                  <StickyNoteNode
                    key={node.id} node={node}
                    selected={selected === node.id}
                    isWiring={!!wiringFrom}
                    onDragStart={handleNodeDragStart}
                    onDelete={deleteNode}
                    onUpdate={updateNodeData}
                    onPortMouseDown={handlePortMouseDown}
                    onNodeMouseDown={onNodeMouseDown}
                    onNavigate={onNavigate}
                    onResizeStart={handleNodeResizeStart}
                    onEditStart={handleEditStart}
                    onContextMenu={handleNodeContextMenu}
                  />
                ) : node.type === "label" ? (
                  <TextLabelNode
                    key={node.id} node={node}
                    selected={selected === node.id}
                    isWiring={!!wiringFrom}
                    onDragStart={handleNodeDragStart}
                    onDelete={deleteNode}
                    onUpdate={updateNodeData}
                    onPortMouseDown={handlePortMouseDown}
                    onNodeMouseDown={onNodeMouseDown}
                    onResizeStart={handleNodeResizeStart}
                    onEditStart={handleEditStart}
                    onContextMenu={handleNodeContextMenu}
                  />
                ) : (
                  <ReferenceCardNode
                    key={node.id} node={node}
                    selected={selected === node.id}
                    isWiring={!!wiringFrom}
                    onDragStart={handleNodeDragStart}
                    onDelete={deleteNode}
                    onUpdate={updateNodeData}
                    onPortMouseDown={handlePortMouseDown}
                    onNodeMouseDown={onNodeMouseDown}
                    onNavigate={onNavigate}
                    onResizeStart={handleNodeResizeStart}
                    onContextMenu={handleNodeContextMenu}
                  />
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Reference dialog */}
      {addRefOpen && (
        <AddRefDialog onAdd={addRefCard} onClose={() => setAddRefOpen(false)} />
      )}

      {/* Right-click context menu */}
      {contextMenu && (() => {
        const node = canvasState.nodes.find(n => n.id === contextMenu.nodeId);
        if (!node) return null;
        return (
          <div
            className="fixed z-50 bg-background border rounded-md shadow-lg py-1 min-w-36 text-sm"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-muted flex items-center gap-2 text-sm"
              onClick={() => { duplicateNode(contextMenu.nodeId); setContextMenu(null); }}
            >
              <Copy size={13} /> Duplicate
            </button>
            {node.type === "note" && (
              <div className="px-3 py-1.5 flex items-center gap-1.5">
                {(["yellow","green","blue","pink"] as const).map(c => (
                  <button
                    key={c}
                    className={cn("w-4 h-4 rounded-full border border-black/10", COLOR_DOT[c])}
                    onClick={() => { updateNodeData(contextMenu.nodeId, { color: c }); setContextMenu(null); }}
                  />
                ))}
              </div>
            )}
            <div className="border-t my-1" />
            <button
              className="w-full px-3 py-1.5 text-left text-destructive hover:bg-destructive/10 flex items-center gap-2 text-sm"
              onClick={() => { deleteNode(contextMenu.nodeId); setContextMenu(null); }}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        );
      })()}
    </div>
  );
}
