import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  Plus, Trash2, ZoomIn, ZoomOut, RotateCcw,
  MessageSquare, FileText, Table2,
  ExternalLink, X, ChevronRight, Loader2, StickyNote, Link2, Type,
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
interface CanvasEdge { id: string; fromNode: string; toNode: string }
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

// ─── Port button (shared) ─────────────────────────────────────────

function Port({ side, connecting, onClick }: {
  side: "in" | "out"; connecting: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className={cn(
        "absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 bg-background z-10 transition-colors",
        side === "in" ? "-left-2.5" : "-right-2.5",
        connecting
          ? "border-primary hover:bg-primary/20 scale-125"
          : "border-muted-foreground/30 hover:border-primary hover:scale-110",
      )}
      onClick={onClick}
    />
  );
}

// ─── StickyNoteNode ───────────────────────────────────────────────

interface NodeProps {
  node: CanvasNode;
  selected: boolean;
  connecting: boolean;
  onDragStart: (nodeId: string, e: React.MouseEvent) => void;
  onDelete: (nodeId: string) => void;
  onUpdate: (nodeId: string, data: Partial<NoteData | RefData>) => void;
  onPortClick: (nodeId: string, side: "out" | "in") => void;
  onSelect: (nodeId: string) => void;
  onNavigate?: (page: any, id?: string) => void;
}

function StickyNoteNode({ node, selected, connecting, onDragStart, onDelete, onUpdate, onPortClick, onSelect }: NodeProps) {
  const data = node.data as NoteData;
  return (
    <div
      className={cn(
        "absolute rounded-lg border-2 shadow-md flex flex-col",
        NOTE_RING[data.color],
        selected && "ring-2 ring-primary ring-offset-1",
      )}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(node.id); }}
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
        onMouseDown={(e) => e.stopPropagation()}
      />
      <Port side="in"  connecting={connecting} onClick={(e) => { e.stopPropagation(); onPortClick(node.id, "in");  }} />
      <Port side="out" connecting={connecting} onClick={(e) => { e.stopPropagation(); onPortClick(node.id, "out"); }} />
    </div>
  );
}

// ─── ReferenceCardNode ────────────────────────────────────────────

const REF_ICON = { chat: MessageSquare, document: FileText, sheet: Table2 } as const;
const REF_COLOR = { chat: "text-violet-500", document: "text-blue-500", sheet: "text-emerald-500" } as const;
const REF_PAGE_MAP = { chat: "chat", document: "documents", sheet: "sheets" } as const;

function ReferenceCardNode({ node, selected, connecting, onDragStart, onDelete, onPortClick, onSelect, onNavigate }: NodeProps) {
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
      onMouseDown={(e) => { e.stopPropagation(); onSelect(node.id); }}
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
      <Port side="in"  connecting={connecting} onClick={(e) => { e.stopPropagation(); onPortClick(node.id, "in");  }} />
      <Port side="out" connecting={connecting} onClick={(e) => { e.stopPropagation(); onPortClick(node.id, "out"); }} />
    </div>
  );
}

// ─── TextLabelNode ────────────────────────────────────────────────

function TextLabelNode({ node, selected, onDragStart, onUpdate, onSelect }: NodeProps) {
  const data = node.data as LabelData;
  const [editing, setEditing] = useState(false);
  return (
    <div
      className={cn(
        "absolute flex items-center justify-center cursor-grab",
        selected && "ring-2 ring-primary ring-offset-1 rounded",
      )}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(node.id); if (!editing) onDragStart(node.id, e); }}
      onDoubleClick={() => setEditing(true)}
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
  const [connecting, setConnecting] = useState<{ fromNodeId: string; side: "out" | "in" } | null>(null);
  const [addRefOpen, setAddRefOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const canvasStateRef = useRef(canvasState);
  canvasStateRef.current = canvasState;
  const activeIdRef = useRef(activeCanvasId);
  activeIdRef.current = activeCanvasId;

  const isPanning = useRef(false);
  const panStart = useRef({ mx: 0, my: 0, vpX: 0, vpY: 0 });
  const isDraggingNode = useRef(false);
  const dragState = useRef<{ nodeId: string; smx: number; smy: number; snx: number; sny: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setConnecting(null);
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
    updateCanvas(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      edges: prev.edges.filter(e => e.fromNode !== nodeId && e.toNode !== nodeId),
    }));
    setSelected(s => s === nodeId ? null : s);
  }

  function updateNodeData(nodeId: string, patch: Partial<NoteData | RefData>) {
    updateCanvas(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } as NoteData | RefData } : n
      ),
    }));
  }

  // ── Connections ───────────────────────────────────────────────────
  function handlePortClick(nodeId: string, side: "out" | "in") {
    if (!connecting) {
      setConnecting({ fromNodeId: nodeId, side });
      return;
    }
    const from = connecting.side === "out" ? connecting.fromNodeId : nodeId;
    const to   = connecting.side === "out" ? nodeId : connecting.fromNodeId;
    if (from !== to) {
      const exists = canvasStateRef.current.edges.some(e => e.fromNode === from && e.toNode === to);
      if (!exists) {
        updateCanvas(prev => ({
          ...prev,
          edges: [...prev.edges, { id: genId(), fromNode: from, toNode: to }],
        }));
      }
    }
    setConnecting(null);
  }

  function deleteEdge(edgeId: string) {
    updateCanvas(prev => ({ ...prev, edges: prev.edges.filter(e => e.id !== edgeId) }));
  }

  // ── Node drag ─────────────────────────────────────────────────────
  function handleNodeDragStart(nodeId: string, e: React.MouseEvent) {
    isDraggingNode.current = true;
    const node = canvasStateRef.current.nodes.find(n => n.id === nodeId)!;
    dragState.current = { nodeId, smx: e.clientX, smy: e.clientY, snx: node.x, sny: node.y };
    setSelected(nodeId);
  }

  // ── Canvas pan ────────────────────────────────────────────────────
  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    setSelected(null);
    if (connecting) { setConnecting(null); return; }
    isPanning.current = true;
    const vp = canvasStateRef.current.viewport;
    panStart.current = { mx: e.clientX, my: e.clientY, vpX: vp.x, vpY: vp.y };
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (isDraggingNode.current && dragState.current) {
        const { nodeId, smx, smy, snx, sny } = dragState.current;
        const scale = canvasStateRef.current.viewport.scale;
        const dx = (e.clientX - smx) / scale;
        const dy = (e.clientY - smy) / scale;
        updateCanvas(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, x: snx + dx, y: sny + dy } : n),
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
    function onMouseUp() {
      isDraggingNode.current = false;
      isPanning.current = false;
      dragState.current = null;
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
            <button
              onClick={() => deleteNode(selected)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
          <div className="flex-1" />
          {connecting && (
            <span className="text-xs text-primary animate-pulse mr-2 select-none">
              Click a port to connect… (Esc to cancel)
            </span>
          )}
          {saving && <span className="text-xs text-muted-foreground mr-2 select-none">Saving…</span>}
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
              connecting ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
            )}
            onMouseDown={handleCanvasMouseDown}
            onWheel={handleWheel}
            onKeyDown={(e) => {
              if (e.key === "Escape") setConnecting(null);
              const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
              if ((e.key === "Delete" || e.key === "Backspace") && selected && !isTyping) {
                e.preventDefault();
                deleteNode(selected);
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
                {canvasState.edges.map(edge => {
                  const fn = canvasState.nodes.find(n => n.id === edge.fromNode);
                  const tn = canvasState.nodes.find(n => n.id === edge.toNode);
                  if (!fn || !tn) return null;
                  return (
                    <path
                      key={edge.id}
                      d={edgePath(fn, tn)}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth={Math.max(1, 2 / vp.scale)}
                      strokeOpacity={0.65}
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onClick={() => deleteEdge(edge.id)}
                    />
                  );
                })}
              </svg>

              {/* Nodes */}
              {canvasState.nodes.map(node =>
                node.type === "note" ? (
                  <StickyNoteNode
                    key={node.id} node={node}
                    selected={selected === node.id}
                    connecting={!!connecting}
                    onDragStart={handleNodeDragStart}
                    onDelete={deleteNode}
                    onUpdate={updateNodeData}
                    onPortClick={handlePortClick}
                    onSelect={setSelected}
                    onNavigate={onNavigate}
                  />
                ) : node.type === "label" ? (
                  <TextLabelNode
                    key={node.id} node={node}
                    selected={selected === node.id}
                    connecting={!!connecting}
                    onDragStart={handleNodeDragStart}
                    onDelete={deleteNode}
                    onUpdate={updateNodeData}
                    onPortClick={handlePortClick}
                    onSelect={setSelected}
                  />
                ) : (
                  <ReferenceCardNode
                    key={node.id} node={node}
                    selected={selected === node.id}
                    connecting={!!connecting}
                    onDragStart={handleNodeDragStart}
                    onDelete={deleteNode}
                    onUpdate={updateNodeData}
                    onPortClick={handlePortClick}
                    onSelect={setSelected}
                    onNavigate={onNavigate}
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
    </div>
  );
}
