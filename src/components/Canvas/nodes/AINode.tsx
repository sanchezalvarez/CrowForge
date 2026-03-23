import { useState, useCallback } from "react";
import {
  Handle,
  Position,
  type NodeProps,
  useReactFlow,
  NodeResizer,
  useStore,
} from "@xyflow/react";
import { Play, Loader2, AlertCircle, Bot, Link, Copy, CornerDownLeft } from "lucide-react";
import { cn } from "../../../lib/utils";
import { CanvasNodeToolbar, getShapeStyle, NodeIcon } from "./NodeToolbar";
import { useCanvasExecution } from "../CanvasExecutionContext";

export type AINodeData = {
  prompt:  string;
  output:  string;
  error?:  string | null;
  color?:  string;
  icon?:   string;
  shape?:  string;
  label?:  string;
};

export function AINode({ id, data, selected }: NodeProps) {
  const nodeData = data as AINodeData;
  const { updateNodeData } = useReactFlow();
  const { triggerNode, runningNodes, scheduleSave } = useCanvasExecution();

  const isRunning = runningNodes.has(id);

  // Local prompt state so the textarea is editable
  const [prompt, setPrompt] = useState(nodeData.prompt ?? "");

  // Sync prompt to node data when user stops typing (on blur)
  const handlePromptBlur = useCallback(() => {
    updateNodeData(id, { prompt });
    scheduleSave();
  }, [id, prompt, updateNodeData, scheduleSave]);

  // Count upstream AI nodes reactively (via RF store)
  const upstreamAICount = useStore(
    useCallback(
      (s) =>
        s.edges.filter(
          (e) =>
            e.target === id &&
            s.nodes.find((n) => n.id === e.source)?.type === "ai",
        ).length,
      [id],
    ),
  );

  const handleRun = useCallback(() => {
    if (isRunning || !prompt.trim()) return;
    // Persist latest prompt before triggering
    updateNodeData(id, { prompt: prompt.trim() });
    triggerNode(id);
  }, [isRunning, prompt, id, updateNodeData, triggerNode]);

  const handleCopyOutput = useCallback(() => {
    if (nodeData.output) navigator.clipboard.writeText(nodeData.output);
  }, [nodeData.output]);

  const handleUseAsPrompt = useCallback(() => {
    const out = nodeData.output ?? "";
    setPrompt(out);
    updateNodeData(id, { prompt: out });
  }, [nodeData.output, id, updateNodeData]);

  const shape      = nodeData.shape ?? "rectangle";
  const shapeStyle = getShapeStyle(shape, nodeData.color);
  const showBorder = shape === "rectangle" || shape === "circle";

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        lineClassName="!border-primary/60"
        handleClassName="!bg-primary !border-background !w-2 !h-2 !rounded-sm"
      />
      <CanvasNodeToolbar id={id} selected={selected} />

      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary/70 !w-2.5 !h-2.5 !border-0"
      />

      <div
        style={shapeStyle}
        className={cn(
          "w-full h-full min-w-[200px] min-h-[120px] text-card-foreground shadow-sm flex flex-col transition-shadow",
          showBorder && (selected ? "border-2 border-primary shadow-md" : "border border-border"),
          // Pulsing ring while running (subtle, not neon)
          isRunning && "ring-2 ring-primary/40 ring-offset-0 animate-pulse",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-muted/40 rounded-t-md shrink-0">
          <NodeIcon name={nodeData.icon} size={12} className="text-primary shrink-0" />
          {!nodeData.icon && <Bot size={12} className="text-primary shrink-0" />}
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">
            AI Node
          </span>
          {/* Chain indicator — shown if this node receives context from upstream */}
          {upstreamAICount > 0 && (
            <span
              className="flex items-center gap-0.5 text-[10px] text-primary/70 font-medium"
              title={`Receives context from ${upstreamAICount} upstream node${upstreamAICount > 1 ? "s" : ""}`}
            >
              <Link size={10} />
              {upstreamAICount}
            </span>
          )}
        </div>

        {/* Prompt area */}
        <div className="px-3 pt-2 pb-1 shrink-0">
          <textarea
            className="w-full text-xs resize-none bg-muted/40 border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary/50 leading-snug"
            rows={3}
            placeholder="Enter prompt…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onBlur={handlePromptBlur}
            onKeyDown={(e) => e.stopPropagation()}
          />

          {/* Context node hint */}
          {upstreamAICount > 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {upstreamAICount} context node{upstreamAICount > 1 ? "s" : ""} will be passed in
            </p>
          )}

          <button
            className={cn(
              "mt-1 w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-colors",
              isRunning
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning
              ? <Loader2 size={11} className="animate-spin" />
              : <Play size={11} />
            }
            {isRunning ? "Running…" : "Run"}
          </button>
        </div>

        {/* Output area */}
        {(nodeData.output || nodeData.error) && (
          <div className="mx-3 mb-1 mt-0.5 rounded-md border bg-muted/30 flex flex-col flex-1 min-h-0 overflow-hidden">
            {nodeData.error ? (
              <div className="flex items-start gap-1.5 text-destructive text-xs px-2 py-1.5">
                <AlertCircle size={11} className="mt-0.5 shrink-0" />
                <span>{nodeData.error}</span>
              </div>
            ) : (
              <pre className="flex-1 overflow-y-auto font-mono text-xs leading-snug whitespace-pre-wrap px-2 py-1.5 max-h-[200px]">
                {nodeData.output}
              </pre>
            )}

            {/* Post-run action buttons */}
            {nodeData.output && !isRunning && (
              <div className="flex items-center gap-1 px-2 py-1 border-t shrink-0">
                <button
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleCopyOutput}
                  title="Copy output to clipboard"
                >
                  <Copy size={10} />
                  Copy
                </button>
                <span className="text-border">·</span>
                <button
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleUseAsPrompt}
                  title="Use output as next prompt"
                >
                  <CornerDownLeft size={10} />
                  Use as prompt
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary/70 !w-2.5 !h-2.5 !border-0"
      />
    </>
  );
}
