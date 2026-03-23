import { useState, useRef, useEffect } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  useReactFlow,
} from "@xyflow/react";

type EdgeStyle = "solid" | "dashed" | "animated";

export function CustomEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps) {
  const edgeData = (data ?? {}) as { label?: string; style?: EdgeStyle };
  const edgeStyle: EdgeStyle = edgeData.style ?? "solid";

  const { updateEdgeData } = useReactFlow();

  // ── Inline label editing ─────────────────────────────────────────────────────
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue,   setLabelValue]   = useState(edgeData.label ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync label when external data changes
  useEffect(() => {
    if (!editingLabel) setLabelValue(edgeData.label ?? "");
  }, [edgeData.label, editingLabel]);

  useEffect(() => {
    if (editingLabel) inputRef.current?.select();
  }, [editingLabel]);

  function commitLabel() {
    setEditingLabel(false);
    updateEdgeData(id, { label: labelValue });
  }

  // ── Path ─────────────────────────────────────────────────────────────────────
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 8,
  });

  // ── Stroke style ─────────────────────────────────────────────────────────────
  const pathStyle: React.CSSProperties = {
    stroke:        "hsl(var(--primary))",
    strokeWidth:   1.5,
    strokeOpacity: 0.7,
    ...(edgeStyle === "dashed"    ? { strokeDasharray: "6 3" } : {}),
    ...(edgeStyle === "animated"  ? {
      strokeDasharray: "10 5",
      animation: "edge-march 0.4s linear infinite",
    } : {}),
    ...style,
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={pathStyle}
      />

      <EdgeLabelRenderer>
        {/* Existing / new label */}
        {(edgeData.label || editingLabel) && (
          <div
            style={{
              transform:     `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="absolute nodrag nopan"
            onDoubleClick={() => setEditingLabel(true)}
          >
            {editingLabel ? (
              <input
                ref={inputRef}
                className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-background border text-foreground shadow-sm outline-none focus:ring-1 focus:ring-primary/50 w-28"
                value={labelValue}
                onChange={(e) => setLabelValue(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitLabel();
                  if (e.key === "Escape") {
                    setEditingLabel(false);
                    setLabelValue(edgeData.label ?? "");
                  }
                  e.stopPropagation();
                }}
              />
            ) : (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-background border text-muted-foreground shadow-sm cursor-text">
                {edgeData.label}
              </span>
            )}
          </div>
        )}

        {/* Invisible hit target to trigger label creation on double-click */}
        {!edgeData.label && !editingLabel && (
          <div
            style={{
              transform:     `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="absolute nodrag nopan w-6 h-6"
            onDoubleClick={() => setEditingLabel(true)}
          />
        )}
      </EdgeLabelRenderer>
    </>
  );
}
