import { useState, useCallback } from "react";
import {
  Handle,
  Position,
  type NodeProps,
  useReactFlow,
  NodeResizer,
  useStore,
} from "@xyflow/react";
import { Play, Loader2, AlertCircle, Bot, Link, Copy, CornerDownLeft, ChevronDown } from "lucide-react";
import { cn } from "../../../lib/utils";
import { CanvasNodeToolbar, getShapeStyle, getNodeShadow, NodeIcon } from "./NodeToolbar";
import { useCanvasExecution } from "../CanvasExecutionContext";

export const AI_BEHAVIORS = [
  { value: "none",      label: "Free prompt" },
  { value: "answer",    label: "Answer" },
  { value: "summarize", label: "Summarize" },
  { value: "translate", label: "Translate" },
  { value: "expand",    label: "Expand" },
  { value: "extract",   label: "Extract key points" },
  { value: "simplify",  label: "Simplify" },
  { value: "classify",  label: "Classify" },
  { value: "rewrite",   label: "Rewrite" },
] as const;

export type AIBehavior = (typeof AI_BEHAVIORS)[number]["value"];

export type AINodeData = {
  prompt:    string;
  output:    string;
  error?:    string | null;
  color?:    string;
  icon?:     string;
  shape?:    string;
  label?:    string;
  behavior?: AIBehavior;
};

export function AINode({ id, data, selected }: NodeProps) {
  const nodeData = data as AINodeData;
  const { updateNodeData } = useReactFlow();
  const { triggerNode, runningNodes, scheduleSave } = useCanvasExecution();

  const isRunning = runningNodes.has(id);

  const [prompt,          setPrompt]          = useState(nodeData.prompt ?? "");
  const [showBehaviorMenu, setShowBehaviorMenu] = useState(false);

  const handlePromptBlur = useCallback(() => {
    updateNodeData(id, { prompt });
    scheduleSave();
  }, [id, prompt, updateNodeData, scheduleSave]);

  const handleBehavior = useCallback((behavior: AIBehavior) => {
    updateNodeData(id, { behavior });
    scheduleSave();
    setShowBehaviorMenu(false);
  }, [id, updateNodeData, scheduleSave]);

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

  const currentBehavior = AI_BEHAVIORS.find(b => b.value === (nodeData.behavior ?? "none")) ?? AI_BEHAVIORS[0];

  const isConnecting = useStore((s) => s.connection.inProgress);
  const handleCls = cn(
    "transition-all duration-150",
    (selected || isConnecting) ? "!opacity-100" : "!opacity-0",
  );

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

      {/* 4 handles — all sides */}
      <Handle type="target"  position={Position.Top}    className={handleCls} />
      <Handle type="source"  position={Position.Bottom} className={handleCls} />
      <Handle type="target"  position={Position.Left}   id="left-target"  className={handleCls} />
      <Handle type="source"  position={Position.Right}  id="right-source" className={handleCls} />

      {/* Drop-shadow wrapper */}
      <div className="w-full h-full" style={getNodeShadow(selected)}>
        <div
          style={shapeStyle}
          className={cn(
            "w-full h-full min-w-[200px] min-h-[120px] text-card-foreground flex flex-col transition-colors",
            showBorder && (selected ? "border-2 border-primary" : "border border-border"),
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

          {/* Behavior selector */}
          <div className="px-3 pt-2 shrink-0 relative">
            <button
              className="w-full flex items-center justify-between gap-1 text-[11px] font-medium bg-muted/50 border border-border/60 rounded px-2 py-1 hover:bg-muted transition-colors"
              onClick={() => setShowBehaviorMenu(v => !v)}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <span className="text-foreground">{currentBehavior.label}</span>
              <ChevronDown size={10} className="text-muted-foreground" />
            </button>
            {showBehaviorMenu && (
              <div className="absolute left-3 right-3 top-full mt-0.5 bg-background border rounded-md shadow-lg z-50 py-0.5">
                {AI_BEHAVIORS.map((b) => (
                  <button
                    key={b.value}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors",
                      b.value === (nodeData.behavior ?? "none") && "bg-primary/10 text-primary font-medium",
                    )}
                    onClick={() => handleBehavior(b.value)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Prompt area */}
          <div className="px-3 pt-2 pb-1 shrink-0">
            <textarea
              className="w-full text-xs resize-none bg-muted/40 border rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary/50 leading-snug"
              rows={3}
              placeholder={currentBehavior.value === "none" ? "Enter prompt…" : `Text to ${currentBehavior.label.toLowerCase()}…`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onBlur={handlePromptBlur}
              onKeyDown={(e) => e.stopPropagation()}
            />

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
      </div>
    </>
  );
}
