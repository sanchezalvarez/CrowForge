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
  "flex items-center gap-2 px-3 py-1.5 text-xs rounded-md cursor-pointer",
  "hover:bg-muted text-foreground transition-colors select-none",
);
const DangerCls = cn(ItemCls, "text-destructive hover:text-destructive hover:bg-destructive/10");
const DisabledCls = cn(ItemCls, "opacity-40 pointer-events-none");
const SepCls = "h-px bg-border my-1";

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

  // Convert screen coords to flow position for adding nodes
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
    // Trigger double-click event on the node's DOM element
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
    const label = window.prompt(
      "Edge label:",
      String(getEdges().find((e) => e.id === target.edgeId)?.data?.label ?? ""),
    );
    if (label !== null) {
      updateEdgeData(target.edgeId, { label });
    }
    onClose();
  }, [target, getEdges, updateEdgeData, onClose]);

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
        minWidth: 180,
      }}
      className="bg-background border rounded-lg shadow-xl p-1"
      onContextMenu={(e) => e.preventDefault()}
    >
      {target.type === "pane" && (
        <>
          <div
            className={ItemCls}
            onClick={() => addAt("text", { label: "" })}
          >
            Add Text Node
          </div>
          <div
            className={ItemCls}
            onClick={() => addAt("ai", { prompt: "", output: "" })}
          >
            Add AI Node
          </div>
          <div
            className={ItemCls}
            onClick={() => addAt("image", { src: "", alt: "" })}
          >
            Add Image Node
          </div>

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
              <div className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">
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
          <div className="px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">
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
        </>
      )}
    </div>
  );
}
