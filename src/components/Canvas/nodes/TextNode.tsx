import { useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, type NodeProps, NodeResizer, useReactFlow, useStore } from "@xyflow/react";
import {
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { CanvasNodeToolbar, getShapeStyle, getNodeShadow, NodeIcon } from "./NodeToolbar";
import { useCanvasExecution } from "../CanvasExecutionContext";

export type TextNodeData = {
  label:          string;
  color?:         string;
  icon?:          string;
  shape?:         string;
  fontSize?:      number;
  bold?:          boolean;
  italic?:        boolean;
  underline?:     boolean;
  textAlign?:     "left" | "center" | "right";
  verticalAlign?: "top" | "center" | "bottom";
};

/** Extra padding so text stays inside the visible area for non-rectangular shapes. */
function shapeContentClass(shape?: string): string {
  switch (shape) {
    case "circle":  return "px-6 py-5";
    case "diamond": return "px-8 py-8";
    case "hexagon": return "px-5 py-6";
    default:        return "px-3 py-2";
  }
}

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 72, 96, 128];

const fmtBtn =
  "p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground";
const fmtBtnActive =
  "p-1.5 rounded bg-muted text-foreground";

const sep = <div className="w-px h-4 bg-border mx-0.5" />;

export function TextNode({ id, data, selected }: NodeProps) {
  const nodeData = data as TextNodeData;
  const { updateNodeData } = useReactFlow();
  const { scheduleSave }   = useCanvasExecution();

  const [editing, setEditing] = useState(false);
  const [label,   setLabel]   = useState(nodeData.label ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setLabel(nodeData.label ?? "");
  }, [nodeData.label, editing]);

  const startEdit = useCallback(() => setEditing(true), []);

  const stopEdit = useCallback(() => {
    setEditing(false);
    updateNodeData(id, { label });
    scheduleSave();
  }, [id, label, updateNodeData, scheduleSave]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const setFormat = useCallback(
    (patch: Partial<TextNodeData>) => {
      updateNodeData(id, patch);
      scheduleSave();
    },
    [id, updateNodeData, scheduleSave],
  );

  const shape      = nodeData.shape ?? "rectangle";
  const shapeStyle = getShapeStyle(shape, nodeData.color);
  const showBorder = shape === "rectangle" || shape === "circle";

  const fontSize      = nodeData.fontSize      ?? 13;
  const bold          = nodeData.bold          ?? false;
  const italic        = nodeData.italic        ?? false;
  const underline     = nodeData.underline     ?? false;
  const textAlign     = nodeData.textAlign     ?? "left";
  const verticalAlign = nodeData.verticalAlign ?? "top";

  const textStyle: React.CSSProperties = {
    fontSize,
    fontWeight:     bold      ? "bold"      : "normal",
    fontStyle:      italic    ? "italic"    : "normal",
    textDecoration: underline ? "underline" : "none",
    textAlign,
  };

  const verticalClass =
    verticalAlign === "center" ? "justify-center"
    : verticalAlign === "bottom" ? "justify-end"
    : "justify-start";

  const hAlignClass =
    textAlign === "center" ? "justify-center"
    : textAlign === "right"  ? "justify-end"
    : "justify-start";

  const iconSize = Math.max(10, Math.round(fontSize * 1.1));

  // ── Formatting row passed to NodeToolbar as secondRow ──────────────────────
  const formattingRow = (
    <>
      {/* Font size */}
      <select
        className="text-[10px] bg-transparent border border-border/50 rounded px-0.5 py-px text-muted-foreground hover:text-foreground cursor-pointer outline-none"
        value={fontSize}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => setFormat({ fontSize: Number(e.target.value) })}
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {sep}

      {/* Bold / Italic / Underline */}
      <button
        className={bold ? fmtBtnActive : fmtBtn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setFormat({ bold: !bold })}
        title="Bold"
      >
        <Bold size={12} />
      </button>
      <button
        className={italic ? fmtBtnActive : fmtBtn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setFormat({ italic: !italic })}
        title="Italic"
      >
        <Italic size={12} />
      </button>
      <button
        className={underline ? fmtBtnActive : fmtBtn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setFormat({ underline: !underline })}
        title="Underline"
      >
        <Underline size={12} />
      </button>

      {sep}

      {/* Horizontal align */}
      <button
        className={textAlign === "left" ? fmtBtnActive : fmtBtn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setFormat({ textAlign: "left" })}
        title="Align left"
      >
        <AlignLeft size={12} />
      </button>
      <button
        className={textAlign === "center" ? fmtBtnActive : fmtBtn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setFormat({ textAlign: "center" })}
        title="Align center"
      >
        <AlignCenter size={12} />
      </button>
      <button
        className={textAlign === "right" ? fmtBtnActive : fmtBtn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setFormat({ textAlign: "right" })}
        title="Align right"
      >
        <AlignRight size={12} />
      </button>

      {sep}

      {/* Vertical align */}
      <button
        className={verticalAlign === "top" ? fmtBtnActive : fmtBtn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setFormat({ verticalAlign: "top" })}
        title="Align top"
      >
        <AlignStartVertical size={12} />
      </button>
      <button
        className={verticalAlign === "center" ? fmtBtnActive : fmtBtn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setFormat({ verticalAlign: "center" })}
        title="Align middle"
      >
        <AlignCenterVertical size={12} />
      </button>
      <button
        className={verticalAlign === "bottom" ? fmtBtnActive : fmtBtn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setFormat({ verticalAlign: "bottom" })}
        title="Align bottom"
      >
        <AlignEndVertical size={12} />
      </button>
    </>
  );

  const isConnecting = useStore((s) => s.connection.inProgress);
  const handleCls = cn(
    "transition-all duration-150",
    (selected || isConnecting) ? "!opacity-100" : "!opacity-0",
  );

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={60}
        lineClassName="!border-primary/60"
        handleClassName="!bg-primary !border-background !w-2 !h-2 !rounded-sm"
      />
      <CanvasNodeToolbar id={id} selected={selected} secondRow={formattingRow} />

      {/* 4 handles — all sides */}
      <Handle type="target"  position={Position.Top}    className={handleCls} />
      <Handle type="source"  position={Position.Bottom} className={handleCls} />
      <Handle type="target"  position={Position.Left}   id="left-target"  className={handleCls} />
      <Handle type="source"  position={Position.Right}  id="right-source" className={handleCls} />

      {/* Drop-shadow wrapper — works with clipPath shapes */}
      <div className="w-full h-full" style={getNodeShadow(selected)}>
        <div
          style={shapeStyle}
          className={cn(
            "w-full h-full min-w-[120px] min-h-[60px] text-card-foreground transition-colors flex flex-col",
            showBorder && (selected ? "border-2 border-primary" : "border border-border"),
          )}
          onDoubleClick={startEdit}
        >
          <div
            className={cn(
              "w-full flex-1 flex flex-col gap-1.5 leading-snug min-h-0",
              shapeContentClass(shape),
              verticalClass,
            )}
          >
            <div className={cn("flex items-center gap-1.5 w-full", hAlignClass)}>
              {nodeData.icon && (
                <NodeIcon name={nodeData.icon} size={iconSize} className="shrink-0" />
              )}

              {editing ? (
                <textarea
                  ref={textareaRef}
                  className="flex-1 resize-none bg-transparent outline-none w-full"
                  style={textStyle}
                  rows={3}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onBlur={stopEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") stopEdit();
                    e.stopPropagation();
                  }}
                />
              ) : label ? (
                <span
                  className="select-none whitespace-pre-wrap"
                  style={textStyle}
                >
                  {label}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
