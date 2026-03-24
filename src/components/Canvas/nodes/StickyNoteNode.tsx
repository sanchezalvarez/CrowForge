import { useState, useRef, useEffect, useCallback } from "react";
import { type NodeProps, NodeResizer, useReactFlow } from "@xyflow/react";
import { useCanvasExecution } from "../CanvasExecutionContext";

export type StickyNoteData = {
  label:     string;
  color?:    string;
  fontSize?: number;
};

const NOTE_COLORS = [
  "#fef08a", // yellow (default)
  "#bfdbfe", // blue
  "#bbf7d0", // green
  "#fecdd3", // pink
  "#e9d5ff", // purple
  "#fed7aa", // orange
];

export function StickyNoteNode({ id, data, selected }: NodeProps) {
  const nodeData = data as StickyNoteData;
  const { updateNodeData } = useReactFlow();
  const { scheduleSave }   = useCanvasExecution();

  const [editing, setEditing] = useState(false);
  const [label,   setLabel]   = useState(nodeData.label ?? "");
  const [, setShowColorPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setLabel(nodeData.label ?? "");
  }, [nodeData.label, editing]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const stopEdit = useCallback(() => {
    setEditing(false);
    updateNodeData(id, { label });
    scheduleSave();
  }, [id, label, updateNodeData, scheduleSave]);

  const handleColorPick = useCallback((color: string) => {
    updateNodeData(id, { color });
    scheduleSave();
    setShowColorPicker(false);
  }, [id, updateNodeData, scheduleSave]);

  const bg    = nodeData.color ?? "#fef08a";
  const fontSize = nodeData.fontSize ?? 13;

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        lineClassName="!border-yellow-400/60"
        handleClassName="!bg-yellow-400 !border-background !w-2 !h-2 !rounded-sm"
      />

      {/* No handles — sticky notes can't be connected */}

      {/* Toolbar shown when selected */}
      {selected && (
        <div
          className="absolute -top-9 left-0 flex items-center gap-1 px-2 py-1 rounded-lg border bg-background shadow-lg z-50"
          style={{ pointerEvents: "all" }}
        >
          {/* Color swatches */}
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              className="w-5 h-5 rounded-full border border-black/10 hover:scale-125 transition-transform"
              style={{ backgroundColor: c }}
              onClick={() => handleColorPick(c)}
              title="Change color"
            />
          ))}
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* Font size */}
          <select
            className="text-[10px] bg-transparent border border-border/50 rounded px-0.5 py-px text-muted-foreground cursor-pointer outline-none"
            value={fontSize}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => { updateNodeData(id, { fontSize: Number(e.target.value) }); scheduleSave(); }}
          >
            {[10, 11, 12, 13, 14, 16, 18, 20, 24].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {/* Note body */}
      <div
        className="w-full h-full min-w-[120px] min-h-[80px] flex flex-col rounded-sm"
        style={{
          backgroundColor: bg,
          filter: selected
            ? "drop-shadow(0 6px 14px rgba(0,0,0,0.18)) drop-shadow(0 2px 4px rgba(0,0,0,0.12))"
            : "drop-shadow(0 3px 8px rgba(0,0,0,0.14)) drop-shadow(0 1px 3px rgba(0,0,0,0.08))",
          border: selected ? "2px solid rgba(0,0,0,0.18)" : "1px solid rgba(0,0,0,0.12)",
          borderRadius: "2px",
        }}
        onDoubleClick={() => setEditing(true)}
      >
        {/* Folded corner decoration */}
        <div
          className="shrink-0 h-5 flex items-center px-2"
          style={{ backgroundColor: "rgba(0,0,0,0.07)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}
        />

        {/* Content area */}
        <div className="flex-1 p-3">
          {editing ? (
            <textarea
              ref={textareaRef}
              className="w-full h-full resize-none bg-transparent outline-none leading-snug"
              style={{ fontSize, color: "rgba(0,0,0,0.8)", fontFamily: "inherit" }}
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
              className="whitespace-pre-wrap select-none leading-snug"
              style={{ fontSize, color: "rgba(0,0,0,0.8)", minHeight: "1em" }}
            >
              {label || <span className="opacity-40">Double-click to edit…</span>}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
