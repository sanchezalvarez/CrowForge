import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  SelectionMode,
  type Node,
  type NodeTypes,
  type EdgeTypes,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCanvasStore }       from "./hooks/useCanvasStore";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { CanvasToolbar }        from "./CanvasToolbar";
import { TextNode }             from "./nodes/TextNode";
import { AINode }               from "./nodes/AINode";
import { ImageNode }            from "./nodes/ImageNode";
import { CustomEdge }           from "./edges/CustomEdge";
import {
  CanvasContextMenu,
  type ContextMenuTarget,
} from "./CanvasContextMenu";
import {
  CanvasExecutionContext,
} from "./CanvasExecutionContext";

// ── Node / edge type registries ───────────────────────────────────────────────
const nodeTypes: NodeTypes = {
  text:  TextNode,
  ai:    AINode,
  image: ImageNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

const DEFAULT_EDGE_OPTIONS = {
  type:      "custom" as const,
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
  data:      { style: "solid" },
};

// ── ID generator ──────────────────────────────────────────────────────────────
let _counter = 0;
function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${++_counter}`;
}

// ── Viewport centre helper ────────────────────────────────────────────────────
function centrePosition(el: HTMLDivElement | null): { x: number; y: number } {
  if (!el) return { x: 0, y: 0 };
  return { x: el.clientWidth / 2 - 120, y: el.clientHeight / 2 - 50 };
}

export function CanvasView() {
  const wrapperRef = useRef<HTMLDivElement>(null!);

  const {
    nodes, edges,
    setNodes, setEdges,
    onNodesChange, onEdgesChange,
    onConnect,
    loaded,
    scheduleSave,
    undo,
    runningNodes,
    triggerNode,
    runFlow,
    toast,
    clearToast,
  } = useCanvasStore();

  // ── Snap to grid ──────────────────────────────────────────────────────────
  const [snapToGrid, setSnapToGrid] = useState<boolean>(
    () => localStorage.getItem("crowforge_canvas_snap") !== "false",
  );
  const handleSnapToggle = useCallback(() => {
    setSnapToGrid((v) => {
      const next = !v;
      localStorage.setItem("crowforge_canvas_snap", String(next));
      return next;
    });
  }, []);

  // ── Context menu ──────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenuTarget | null>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // ── Add node helpers ──────────────────────────────────────────────────────
  const addNode = useCallback(
    (
      type: string,
      data: Record<string, unknown>,
      position?: { x: number; y: number },
    ) => {
      const pos = position ?? centrePosition(wrapperRef.current);
      const node: Node = {
        id:   uid(type),
        type,
        position: pos,
        data,
        ...(type === "image" ? { style: { width: 240, height: 200 } } : {}),
      };
      setNodes((nds) => [...nds, node]);
      scheduleSave();
    },
    [setNodes, scheduleSave],
  );

  const handleAddText  = useCallback(() => addNode("text",  { label: "" }),             [addNode]);
  const handleAddAI    = useCallback(() => addNode("ai",    { prompt: "", output: "" }), [addNode]);
  const handleAddImage = useCallback(() => addNode("image", { src: "", alt: "" }),       [addNode]);

  const handleClear = useCallback(() => {
    if (!window.confirm("Clear all nodes and edges?")) return;
    setNodes([]);
    setEdges([]);
    scheduleSave();
  }, [setNodes, setEdges, scheduleSave]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useKeyboardShortcuts({ undo, scheduleSave });

  // ── Execution context value ───────────────────────────────────────────────
  const executionCtx = { triggerNode, runningNodes, runFlow, scheduleSave };

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading canvas…
      </div>
    );
  }

  return (
    <CanvasExecutionContext.Provider value={executionCtx}>
      <div className="flex flex-col h-full w-full">
        <CanvasToolbar
          onAddText={handleAddText}
          onAddAI={handleAddAI}
          onAddImage={handleAddImage}
          onClear={handleClear}
          snapToGrid={snapToGrid}
          onSnapToggle={handleSnapToggle}
        />

        <div ref={wrapperRef} className="flex-1 overflow-hidden relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            style={{ background: "hsl(var(--background))" }}
            snapToGrid={snapToGrid}
            snapGrid={[16, 16]}
            selectionMode={SelectionMode.Partial}
            selectionOnDrag
            panOnDrag={[1, 2]}
            onPaneContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ type: "pane", x: e.clientX, y: e.clientY });
            }}
            onNodeContextMenu={(e, node) => {
              e.preventDefault();
              setContextMenu({ type: "node", x: e.clientX, y: e.clientY, nodeId: node.id });
            }}
            onEdgeContextMenu={(e, edge) => {
              e.preventDefault();
              setContextMenu({ type: "edge", x: e.clientX, y: e.clientY, edgeId: edge.id });
            }}
            onPaneClick={closeContextMenu}
            onNodeClick={closeContextMenu}
            onEdgeClick={closeContextMenu}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.5}
              color="hsl(var(--muted-foreground) / 0.18)"
            />
            <Controls
              showInteractive={false}
              className="[&>button]:!bg-background [&>button]:!border [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted"
            />
            <MiniMap
              nodeColor="hsl(var(--muted))"
              maskColor="hsl(var(--background) / 0.7)"
              className="!bg-background !border !border-border !rounded-lg"
            />
          </ReactFlow>

          {contextMenu && (
            <CanvasContextMenu
              target={contextMenu}
              onClose={closeContextMenu}
              onAddNode={addNode}
            />
          )}

          {toast && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-destructive/90 text-destructive-foreground text-xs font-medium rounded-lg shadow-lg">
              {toast}
              <button className="ml-2 opacity-70 hover:opacity-100" onClick={clearToast}>✕</button>
            </div>
          )}
        </div>
      </div>
    </CanvasExecutionContext.Provider>
  );
}
