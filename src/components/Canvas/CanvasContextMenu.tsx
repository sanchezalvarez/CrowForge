import { useCallback, useEffect, useRef } from "react";
import { useReactFlow, type Node } from "@xyflow/react";
import { cn } from "../../lib/utils";

// Module-level clipboard — doesn't need reactivity
let nodeClipboard: Node[] | null = null;

export type ContextMenuTarget =
  | { type: "pane"; x: number; y: number }
  | { type: "node"; x: number; y: number; nodeId: string }
  | { type: "edge"; x: number; y: number; edgeId: string };

interface Props {
  target: ContextMenuTarget;
  onClose: () => void;
  onAddNode: (
    type: string,
    data: Record<string, unknown>,
    position?: { x: number; y: number },
  ) => void;
}

const ItemCls = cn(
  "flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer select-none transition-colors",
  "font-mono-ui text-[11px] text-foreground hover:bg-muted/60",
);
const DangerCls = cn(ItemCls, "text-destructive hover:text-destructive hover:bg-destructive/10");
const DisabledCls = cn(ItemCls, "opacity-40 pointer-events-none");
const SepCls = "h-px my-1 bg-border-strong" as const;

let _pasteCounter = 0;
function pasteId() {
  return `paste-${Date.now()}-${++_pasteCounter}`;
}

export function CanvasContextMenu({ target, onClose, onAddNode }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const {
    getNodes,
    getEdges,
    setNodes,
    setEdges,
    deleteElements,
    fitView,
    screenToFlowPosition,
    updateEdgeData,
  } = useReactFlow();

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  const flowPos = useCallback(
    () => screenToFlowPosition({ x: target.x, y: target.y }),
    [screenToFlowPosition, target.x, target.y],
  );

  // ── Pane actions ────────────────────────────────────────────────────────────
  const addAt = useCallback(
    (type: string, data: Record<string, unknown>) => {
      onAddNode(type, data, flowPos());
      onClose();
    },
    [onAddNode, flowPos, onClose],
  );

  const handlePaste = useCallback(() => {
    if (!nodeClipboard?.length) return;
    const pos = flowPos();
    const base = nodeClipboard[0];
    const dx = pos.x - base.position.x;
    const dy = pos.y - base.position.y;
    const pasted: Node[] = nodeClipboard.map((n) => ({
      ...n,
      id: pasteId(),
      position: { x: n.position.x + dx, y: n.position.y + dy },
      selected: false,
    }));
    setNodes((nds) => [...nds, ...pasted]);
    onClose();
  }, [flowPos, setNodes, onClose]);

  const handleSelectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: true })));
    onClose();
  }, [setNodes, setEdges, onClose]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 400 });
    onClose();
  }, [fitView, onClose]);

  // ── Node actions ────────────────────────────────────────────────────────────
  const handleNodeEditLabel = useCallback(() => {
    if (target.type !== "node") return;
    const el = document.querySelector(
      `[data-id="${target.nodeId}"]`,
    ) as HTMLElement | null;
    el?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    onClose();
  }, [target, onClose]);

  const handleNodeDuplicate = useCallback(() => {
    if (target.type !== "node") return;
    const node = getNodes().find((n) => n.id === target.nodeId);
    if (!node) return;
    setNodes((nds) => [
      ...nds,
      {
        ...node,
        id: pasteId(),
        position: { x: node.position.x + 30, y: node.position.y + 30 },
        selected: false,
      },
    ]);
    onClose();
  }, [target, getNodes, setNodes, onClose]);

  const handleNodeCopy = useCallback(() => {
    if (target.type !== "node") return;
    const node = getNodes().find((n) => n.id === target.nodeId);
    if (node) nodeClipboard = [node];
    onClose();
  }, [target, getNodes, onClose]);

  const handleNodeDelete = useCallback(() => {
    if (target.type !== "node") return;
    const edges = getEdges().filter(
      (e) => e.source === target.nodeId || e.target === target.nodeId,
    );
    deleteElements({ nodes: [{ id: target.nodeId }], edges });
    onClose();
  }, [target, getEdges, deleteElements, onClose]);

  const handleBringToFront = useCallback(() => {
    if (target.type !== "node") return;
    const maxZ = Math.max(0, ...getNodes().map((n) => (n.zIndex ?? 0)));
    setNodes((nds) =>
      nds.map((n) =>
        n.id === target.nodeId ? { ...n, zIndex: maxZ + 1 } : n,
      ),
    );
    onClose();
  }, [target, getNodes, setNodes, onClose]);

  const handleSendToBack = useCallback(() => {
    if (target.type !== "node") return;
    const minZ = Math.min(0, ...getNodes().map((n) => (n.zIndex ?? 0)));
    setNodes((nds) =>
      nds.map((n) =>
        n.id === target.nodeId ? { ...n, zIndex: minZ - 1 } : n,
      ),
    );
    onClose();
  }, [target, getNodes, setNodes, onClose]);

  const handleNodeEdgeStyle = useCallback(
    (style: string) => {
      if (target.type !== "node") return;
      setEdges((eds) =>
        eds.map((e) =>
          e.source === target.nodeId || e.target === target.nodeId
            ? { ...e, data: { ...e.data, style } }
            : e,
        ),
      );
      onClose();
    },
    [target, setEdges, onClose],
  );

  // ── Edge actions ────────────────────────────────────────────────────────────
  const handleEdgeEditLabel = useCallback(() => {
    if (target.type !== "edge") return;
    // Trigger inline editing via _startEditing flag — no window.prompt
    updateEdgeData(target.edgeId, { _startEditing: true });
    onClose();
  }, [target, updateEdgeData, onClose]);

  const handleEdgeDelete = useCallback(() => {
    if (target.type !== "edge") return;
    deleteElements({ nodes: [], edges: [{ id: target.edgeId }] });
    onClose();
  }, [target, deleteElements, onClose]);

  const handleEdgeStyle = useCallback(
    (style: string) => {
      if (target.type !== "edge") return;
      updateEdgeData(target.edgeId, { style });
      onClose();
    },
    [target, updateEdgeData, onClose],
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  const nodeHasEdges =
    target.type === "node" &&
    getEdges().some(
      (e) => e.source === target.nodeId || e.target === target.nodeId,
    );

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: target.x,
        top: target.y,
        zIndex: 9999,
        minWidth: 190,
        border: "1.5px solid var(--border-strong)",
        background: "var(--card)",
        boxShadow: "3px 3px 0 var(--riso-teal)",
        backgroundImage: "var(--noise-subtle)",
        backgroundRepeat: "repeat",
      }}
      className="rounded-lg p-1"
      onContextMenu={(e) => e.preventDefault()}
    >
      {target.type === "pane" && (
        <>
          <div className={ItemCls} onClick={() => addAt("text",       { label: "" })}>
            Add Text Node
          </div>
          <div className={ItemCls} onClick={() => addAt("ai",         { prompt: "", output: "" })}>
            Add AI Node
          </div>
          <div className={ItemCls} onClick={() => addAt("image",      { src: "", alt: "" })}>
            Add Image Node
          </div>
          <div className={ItemCls} onClick={() => addAt("sticky",     { label: "" })}>
            Add Sticky Note
          </div>
          <div className={ItemCls} onClick={() => addAt("annotation", { label: "", fontSize: 14 })}>
            Add Text Label
          </div>
          <div className={ItemCls} onClick={() => addAt("hyperlink",  { url: "", title: "" })}>
            Add Hyperlink
          </div>

          <div className={SepCls} />
          <div
            className={nodeClipboard ? ItemCls : DisabledCls}
            onClick={nodeClipboard ? handlePaste : undefined}
          >
            Paste
          </div>
          <div className={SepCls} />
          <div className={ItemCls} onClick={handleSelectAll}>
            Select All
          </div>
          <div className={ItemCls} onClick={handleFitView}>
            Fit View
          </div>
        </>
      )}

      {target.type === "node" && (
        <>
          <div className={ItemCls} onClick={handleNodeEditLabel}>
            Edit Label
          </div>
          <div className={ItemCls} onClick={handleNodeCopy}>
            Copy
          </div>
          <div className={ItemCls} onClick={handleNodeDuplicate}>
            Duplicate
          </div>
          <div className={DangerCls} onClick={handleNodeDelete}>
            Delete
          </div>
          <div className={SepCls} />
          <div className={ItemCls} onClick={handleBringToFront}>
            Bring to Front
          </div>
          <div className={ItemCls} onClick={handleSendToBack}>
            Send to Back
          </div>
          {nodeHasEdges && (
            <>
              <div className={SepCls} />
              <div className="px-3 py-1 font-mono-ui text-[10px] text-muted-foreground uppercase tracking-widest">
                Connected Edge Style
              </div>
              <div className={ItemCls} onClick={() => handleNodeEdgeStyle("solid")}>
                Solid
              </div>
              <div className={ItemCls} onClick={() => handleNodeEdgeStyle("dashed")}>
                Dashed
              </div>
              <div className={ItemCls} onClick={() => handleNodeEdgeStyle("animated")}>
                Animated
              </div>
            </>
          )}
        </>
      )}

      {target.type === "edge" && (
        <>
          <div className={ItemCls} onClick={handleEdgeEditLabel}>
            Edit Label
          </div>
          <div className={DangerCls} onClick={handleEdgeDelete}>
            Delete
          </div>
          <div className={SepCls} />
          <div className="px-3 py-1 font-mono-ui text-[10px] text-muted-foreground uppercase tracking-widest">
            Style
          </div>
          <div className={ItemCls} onClick={() => handleEdgeStyle("solid")}>
            Solid
          </div>
          <div className={ItemCls} onClick={() => handleEdgeStyle("dashed")}>
            Dashed
          </div>
          <div className={ItemCls} onClick={() => handleEdgeStyle("animated")}>
            Animated
          </div>
          <div className={SepCls} />
          <div className="px-3 py-1 font-mono-ui text-[10px] text-muted-foreground uppercase tracking-widest">
            Width
          </div>
          <div className={ItemCls} onClick={() => { updateEdgeData(target.edgeId, { width: "thin" }); onClose(); }}>
            Thin
          </div>
          <div className={ItemCls} onClick={() => { updateEdgeData(target.edgeId, { width: "medium" }); onClose(); }}>
            Medium
          </div>
          <div className={ItemCls} onClick={() => { updateEdgeData(target.edgeId, { width: "thick" }); onClose(); }}>
            Thick
          </div>
          <div className={SepCls} />
          <div className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">
            Color
          </div>
          {[
            { label: "Default",  value: "" },
            { label: "Blue",     value: "#3b82f6" },
            { label: "Green",    value: "#10b981" },
            { label: "Amber",    value: "#f59e0b" },
            { label: "Rose",     value: "#f43f5e" },
            { label: "Violet",   value: "#8b5cf6" },
            { label: "Slate",    value: "#64748b" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className={ItemCls}
              onClick={() => { updateEdgeData(target.edgeId, { color: value || undefined }); onClose(); }}
            >
              <span
                className="w-3 h-3 rounded-full border border-border shrink-0"
                style={{ backgroundColor: value || "var(--primary)" }}
              />
              {label}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
