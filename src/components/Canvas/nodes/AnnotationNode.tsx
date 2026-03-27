import { useState, useRef, useEffect, useCallback } from "react";
import { type NodeProps, NodeResizer, useReactFlow } from "@xyflow/react";
import { useCanvasExecution } from "../CanvasExecutionContext";

export type AnnotationData = {
  label:     string;
  fontSize?: number;
  bold?:     boolean;
  color?:    string;
};

const TEXT_COLORS = [
  { label: "Default",  value: "" },
  { label: "Muted",    value: "var(--muted-foreground)" },
  { label: "Primary",  value: "var(--primary)" },
  { label: "Red",      value: "#ef4444" },
  { label: "Blue",     value: "#3b82f6" },
  { label: "Green",    value: "#22c55e" },
  { label: "Purple",   value: "#a855f7" },
];

export function AnnotationNode({ id, data, selected }: NodeProps) {
  const nodeData = data as AnnotationData;
  const { updateNodeData } = useReactFlow();
  const { scheduleSave }   = useCanvasExecution();

  const [editing, setEditing] = useState(false);
  const [label,   setLabel]   = useState(nodeData.label ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLabel(nodeData.label ?? "");
  }, [nodeData.label]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const stopEdit = useCallback(() => {
    setEditing(false);
    updateNodeData(id, { label });
    scheduleSave();
  }, [id, label, updateNodeData, scheduleSave]);

  const setFmt = useCallback((patch: Partial<AnnotationData>) => {
    updateNodeData(id, patch);
    scheduleSave();
  }, [id, updateNodeData, scheduleSave]);

  const fontSize = nodeData.fontSize ?? 14;
  const bold     = nodeData.bold     ?? false;
  const color    = nodeData.color    ?? "";

  const textStyle: React.CSSProperties = {
    fontSize,
    fontWeight: bold ? "bold" : "normal",
    color: color || "var(--foreground)",
  };

  const isEmpty = !label.trim();

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={60}
        minHeight={20}
        lineClassName="!border-primary/40"
        handleClassName="!bg-primary !border-background !w-2 !h-2 !rounded-sm"
      />

      {/* No handles — annotations are decorative only */}

      {/* Toolbar */}
      {selected && (
        <div
          className="absolute -top-9 left-0 flex items-center gap-1 px-2 py-1 rounded-lg border bg-background shadow-lg z-50"
          style={{ pointerEvents: "all" }}
        >
          <select
            className="text-[10px] bg-transparent border border-border/50 rounded px-0.5 py-px text-muted-foreground cursor-pointer outline-none"
            value={fontSize}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setFmt({ fontSize: Number(e.target.value) })}
          >
            {[10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            className={`p-1.5 rounded text-[11px] font-bold transition-colors ${bold ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setFmt({ bold: !bold })}
            title="Bold"
          >
            B
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* Text color swatches */}
          {TEXT_COLORS.map((c) => (
            <button
              key={c.label}
              className="w-4 h-4 rounded-full border border-border/60 hover:scale-125 transition-transform"
              style={{ backgroundColor: c.value || "var(--foreground)" }}
              title={c.label}
              onClick={() => setFmt({ color: c.value })}
            />
          ))}
        </div>
      )}

      {/* Text content — no background, no border (dashed outline when empty) */}
      <div
        className="w-full h-full"
        style={isEmpty && !editing ? { border: "1.5px dashed color-mix(in srgb, var(--muted-foreground) 40%, transparent)", borderRadius: 4 } : undefined}
        onDoubleClick={() => setEditing(true)}
      >
        {editing ? (
          <textarea
            ref={textareaRef}
            className="w-full h-full resize-none bg-transparent outline-none leading-snug px-1"
            style={textStyle}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={stopEdit}
            onKeyDown={(e) => {
              if (e.key === "Escape") stopEdit();
              e.stopPropagation();
            }}
          />
        ) : (
          <p
            className="whitespace-pre-wrap select-none leading-snug px-1"
            style={{ ...textStyle, minHeight: "1em" }}
          >
            {isEmpty
              ? <span className="opacity-30 text-sm">Double-click to edit…</span>
              : label}
          </p>
        )}
      </div>
    </>
  );
}
