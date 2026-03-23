import { useState, useRef, useEffect, useCallback } from "react";
import { type NodeProps, NodeResizer, useReactFlow } from "@xyflow/react";
import { cn } from "../../../lib/utils";

export type GroupNodeData = {
  label: string;
};

export function GroupNode({ id, data, selected }: NodeProps) {
  const nodeData = data as GroupNodeData;
  const { updateNodeData } = useReactFlow();

  const [editing, setEditing] = useState(false);
  const [label,   setLabel]   = useState(nodeData.label ?? "Group");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external label changes
  useEffect(() => {
    if (!editing) setLabel(nodeData.label ?? "Group");
  }, [nodeData.label, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const stopEdit = useCallback(() => {
    setEditing(false);
    updateNodeData(id, { label });
  }, [id, label, updateNodeData]);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={100}
        lineClassName="!border-primary"
        handleClassName="!bg-primary !border-background !w-2 !h-2 !rounded-sm"
      />

      {/* absolute inset-0 fills the RF node wrapper unconditionally */}
      <div className={cn(
        "absolute inset-0 rounded-xl border-2 border-dashed bg-muted/10",
        selected ? "border-primary" : "border-border",
      )}>
        {/* inner wrapper gives positioning context for the label */}
        <div className="relative w-full h-full">
        {/* Editable label */}
        <div
          className="absolute top-2 left-3"
          onDoubleClick={() => setEditing(true)}
        >
          {editing ? (
            <input
              ref={inputRef}
              className="text-xs font-semibold text-muted-foreground bg-background/80 border rounded px-1 outline-none focus:ring-1 focus:ring-primary/50 max-w-[160px]"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={stopEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") stopEdit();
                if (e.key === "Escape") {
                  setEditing(false);
                  setLabel(nodeData.label ?? "Group");
                }
                e.stopPropagation();
              }}
            />
          ) : (
            <span
              className="text-xs font-semibold text-muted-foreground select-none cursor-text"
              title="Double-click to rename"
            >
              {label || "Group"}
            </span>
          )}
        </div>
        </div>
      </div>
    </>
  );
}
