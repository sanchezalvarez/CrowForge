import { useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "../../../lib/utils";

export type TextNodeData = {
  label: string;
};

export function TextNode({ data, selected }: NodeProps) {
  const nodeData = data as TextNodeData;
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(nodeData.label ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external data changes (e.g. from undo/redo or load)
  useEffect(() => {
    if (!editing) setLabel(nodeData.label ?? "");
  }, [nodeData.label, editing]);

  const startEdit = useCallback(() => setEditing(true), []);

  const stopEdit = useCallback(() => {
    setEditing(false);
    // Bubble update up via custom event (CanvasView listens)
    document.dispatchEvent(
      new CustomEvent("canvas:updateNodeData", { detail: { label } }),
    );
  }, [label]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  return (
    <div
      className={cn(
        "min-w-[160px] max-w-[320px] rounded-lg border-2 bg-card text-card-foreground shadow-sm transition-shadow",
        selected ? "border-primary shadow-md" : "border-border",
      )}
      onDoubleClick={startEdit}
    >
      <Handle type="target" position={Position.Top}    className="!bg-primary/70 !w-2.5 !h-2.5 !border-0" />

      <div className="px-3 py-2 text-sm leading-snug min-h-[36px] flex items-center">
        {editing ? (
          <textarea
            ref={textareaRef}
            className="w-full resize-none bg-transparent text-sm outline-none"
            rows={3}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={stopEdit}
            onKeyDown={(e) => {
              if (e.key === "Escape") stopEdit();
              e.stopPropagation(); // prevent RF keyboard shortcuts while typing
            }}
          />
        ) : (
          <span className={cn("select-none whitespace-pre-wrap", !label && "text-muted-foreground italic text-xs")}>
            {label || "Double-click to edit…"}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary/70 !w-2.5 !h-2.5 !border-0" />
    </div>
  );
}
