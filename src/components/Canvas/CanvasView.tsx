import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  SelectionMode,
  type Node,
  type Edge,
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
import { StickyNoteNode }       from "./nodes/StickyNoteNode";
import { AnnotationNode }       from "./nodes/AnnotationNode";
import { HyperlinkNode }        from "./nodes/HyperlinkNode";
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
  text:       TextNode,
  ai:         AINode,
  image:      ImageNode,
  sticky:     StickyNoteNode,
  annotation: AnnotationNode,
  hyperlink:  HyperlinkNode,
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

interface CanvasViewProps {
  canvasId?: string;
}

export function CanvasView({ canvasId }: CanvasViewProps) {
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
  } = useCanvasStore(canvasId);

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
        ...(type === "sticky"     ? { style: { width: 200, height: 160 } } : {}),
        ...(type === "annotation" ? { style: { width: 200, height: 50 } } : {}),
      };
      setNodes((nds) => [...nds, node]);
      scheduleSave();
    },
    [setNodes, scheduleSave],
  );

  const handleAddText       = useCallback(() => addNode("text",       { label: "" }),                          [addNode]);
  const handleAddAI         = useCallback(() => addNode("ai",         { prompt: "", output: "", behavior: "none" }), [addNode]);
  const handleAddImage      = useCallback(() => addNode("image",      { src: "", alt: "" }),                   [addNode]);
  const handleAddSticky     = useCallback(() => addNode("sticky",     { label: "" }),                          [addNode]);
  const handleAddAnnotation = useCallback(() => addNode("annotation", { label: "", fontSize: 14 }),             [addNode]);
  const handleAddHyperlink  = useCallback(() => addNode("hyperlink",  { url: "", title: "" }),                  [addNode]);

  const handleClear = useCallback(() => {
    if (!window.confirm("Clear all nodes and edges?")) return;
    setNodes([]);
    setEdges([]);
    scheduleSave();
  }, [setNodes, setEdges, scheduleSave]);

  const handleImportJSON = useCallback(
    (data: { nodes: unknown[]; edges: unknown[] }) => {
      setNodes(data.nodes as Node[]);
      setEdges(data.edges as Edge[]);
      scheduleSave();
    },
    [setNodes, setEdges, scheduleSave],
  );

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
          onAddSticky={handleAddSticky}
          onAddAnnotation={handleAddAnnotation}
          onAddHyperlink={handleAddHyperlink}
          onClear={handleClear}
          snapToGrid={snapToGrid}
          onSnapToggle={handleSnapToggle}
          onImportJSON={handleImportJSON}
        />

        <div ref={wrapperRef} className="flex-1 overflow-hidden relative">
          <div className="halftone-patch" style={{ top: -30, right: -30, width: 200, height: 200, pointerEvents: "none" }} />
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
            style={{ background: `radial-gradient(ellipse at 80% 20%, rgba(224,78,14,.05) 0%, transparent 60%), radial-gradient(ellipse at 10% 80%, rgba(11,114,104,.05) 0%, transparent 55%), var(--canvas-bg)` }}
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
              id="riso-layer1"
              variant={BackgroundVariant.Dots}
              gap={24}
              size={2.2}
              color="rgba(220, 70, 50, 0.22)"
            />
            <Background
              id="riso-layer2"
              variant={BackgroundVariant.Dots}
              gap={24}
              size={2.2}
              offset={[3, 2]}
              color="rgba(25, 150, 170, 0.18)"
            />
            <Controls
              showInteractive={false}
              className="[&>button]:!bg-background [&>button]:!border [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted"
            />
            <MiniMap
              nodeColor="var(--muted)"
              maskColor="color-mix(in srgb, var(--background) 70%, transparent)"
              className="!bg-background !border !border-border !rounded-lg"
            />
          </ReactFlow>

          {nodes.length === 0 && loaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10">
              <svg width="200" height="180" viewBox="0 0 200 180" fill="none" style={{ opacity: 0.7 }}>
                <line x1="10" y1="20" x2="30" y2="20" stroke="rgba(11,114,104,0.4)" strokeWidth="1.5" />
                <line x1="20" y1="10" x2="20" y2="30" stroke="rgba(11,114,104,0.4)" strokeWidth="1.5" />
                <line x1="170" y1="20" x2="190" y2="20" stroke="rgba(224,78,14,0.35)" strokeWidth="1.5" />
                <line x1="180" y1="10" x2="180" y2="30" stroke="rgba(224,78,14,0.35)" strokeWidth="1.5" />
                <line x1="10" y1="160" x2="30" y2="160" stroke="rgba(92,58,156,0.35)" strokeWidth="1.5" />
                <line x1="20" y1="150" x2="20" y2="170" stroke="rgba(92,58,156,0.35)" strokeWidth="1.5" />
                <line x1="170" y1="160" x2="190" y2="160" stroke="rgba(11,114,104,0.3)" strokeWidth="1.5" />
                <line x1="180" y1="150" x2="180" y2="170" stroke="rgba(11,114,104,0.3)" strokeWidth="1.5" />
                <rect x="75" y="60" width="50" height="30" rx="6"
                  fill="rgba(224,78,14,0.08)" stroke="rgba(224,78,14,0.35)" strokeWidth="1.5" strokeDasharray="4 2" />
                <rect x="30" y="110" width="50" height="30" rx="6"
                  fill="rgba(11,114,104,0.08)" stroke="rgba(11,114,104,0.3)" strokeWidth="1.5" strokeDasharray="4 2" />
                <rect x="120" y="110" width="50" height="30" rx="6"
                  fill="rgba(92,58,156,0.08)" stroke="rgba(92,58,156,0.3)" strokeWidth="1.5" strokeDasharray="4 2" />
                <line x1="100" y1="90" x2="55" y2="110" stroke="rgba(11,114,104,0.25)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="100" y1="90" x2="145" y2="110" stroke="rgba(92,58,156,0.22)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="155" cy="50" r="3" fill="rgba(224,78,14,0.25)" />
                <circle cx="162" cy="44" r="2" fill="rgba(224,78,14,0.15)" />
                <circle cx="148" cy="56" r="1.5" fill="rgba(224,78,14,0.18)" />
                <circle cx="40" cy="55" r="2.5" fill="rgba(11,114,104,0.2)" />
                <circle cx="35" cy="48" r="1.5" fill="rgba(11,114,104,0.15)" />
              </svg>
              <p className="font-display text-sm font-semibold riso-title mt-2" style={{ color: 'var(--muted-foreground)' }}>
                Empty Canvas
              </p>
              <p className="text-xs mt-1 font-mono-ui" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
                Use the toolbar above to add nodes
              </p>
            </div>
          )}

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
