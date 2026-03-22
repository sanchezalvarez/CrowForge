import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type NodeTypes,
  type EdgeTypes,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useCanvasStore } from "./hooks/useCanvasStore";
import { CanvasToolbar } from "./CanvasToolbar";
import { TextNode }  from "./nodes/TextNode";
import { AINode }    from "./nodes/AINode";
import { ImageNode } from "./nodes/ImageNode";
import { GroupNode } from "./nodes/GroupNode";
import { CustomEdge } from "./edges/CustomEdge";

// ── Node / edge type registries ───────────────────────────────────
const nodeTypes: NodeTypes = {
  text:  TextNode,
  ai:    AINode,
  image: ImageNode,
  group: GroupNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

const DEFAULT_EDGE_OPTIONS = {
  type: "custom" as const,
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
};

// ── Helper to generate simple ids ─────────────────────────────────
let _counter = 0;
function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${++_counter}`;
}

// ── Viewport centre helper ─────────────────────────────────────────
function centrePosition(
  reactFlowWrapper: React.RefObject<HTMLDivElement>,
): { x: number; y: number } {
  const el = reactFlowWrapper.current;
  if (!el) return { x: 0, y: 0 };
  return { x: el.clientWidth / 2 - 120, y: el.clientHeight / 2 - 50 };
}

import { useRef } from "react";

export function CanvasView() {
  const wrapperRef = useRef<HTMLDivElement>(null!);
  const {
    nodes, edges,
    setNodes, setEdges,
    onNodesChange, onEdgesChange,
    onConnect,
    loaded,
    scheduleSave,
  } = useCanvasStore();

  // ── Add node helpers ────────────────────────────────────────────
  const addNode = useCallback(
    (type: string, data: Record<string, unknown>) => {
      const pos = centrePosition(wrapperRef);
      const node: Node = {
        id:       uid(type),
        type,
        position: pos,
        data,
        ...(type === "group" ? { style: { width: 280, height: 200 } } : {}),
      };
      setNodes((nds) => [...nds, node]);
      scheduleSave();
    },
    [setNodes, scheduleSave],
  );

  const handleAddText  = useCallback(() => addNode("text",  { label: "" }),          [addNode]);
  const handleAddAI    = useCallback(() => addNode("ai",    { prompt: "", output: "" }), [addNode]);
  const handleAddImage = useCallback(() => addNode("image", { src: "", alt: "" }),    [addNode]);
  const handleAddGroup = useCallback(() => addNode("group", { label: "Group" }),      [addNode]);

  const handleClear = useCallback(() => {
    if (!window.confirm("Clear all nodes and edges?")) return;
    setNodes([]);
    setEdges([]);
    scheduleSave();
  }, [setNodes, setEdges, scheduleSave]);

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading canvas…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar lives outside ReactFlow so it always renders on top */}
      <CanvasToolbar
        onAddText={handleAddText}
        onAddAI={handleAddAI}
        onAddImage={handleAddImage}
        onAddGroup={handleAddGroup}
        onClear={handleClear}
      />

      {/* React Flow canvas */}
      <div ref={wrapperRef} className="flex-1 overflow-hidden">
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
          deleteKeyCode="Delete"
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
      </div>
    </div>
  );
}
