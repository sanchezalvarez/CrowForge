import { useState, useCallback } from "react";
import {
  NodeToolbar,
  Position,
  useReactFlow,
  useStore,
  type Node,
} from "@xyflow/react";
import {
  Trash2, Copy, Smile,
  Star, Zap, Brain, Database, Globe, Lock, Mail, Settings,
  User, Code, FileText, Image, Link, Bell, Check, X as XIcon,
  Square, Circle, Diamond, Hexagon,
} from "lucide-react";
import { cn } from "../../../lib/utils";

// ── Icon palette with preset colors ───────────────────────────────────────────
export const ICON_OPTIONS = [
  { name: "Star",     Component: Star,     color: "#f59e0b" },
  { name: "Zap",      Component: Zap,      color: "#8b5cf6" },
  { name: "Brain",    Component: Brain,    color: "#3b82f6" },
  { name: "Database", Component: Database, color: "#10b981" },
  { name: "Globe",    Component: Globe,    color: "#06b6d4" },
  { name: "Lock",     Component: Lock,     color: "#f97316" },
  { name: "Mail",     Component: Mail,     color: "#ec4899" },
  { name: "Settings", Component: Settings, color: "#6b7280" },
  { name: "User",     Component: User,     color: "#14b8a6" },
  { name: "Code",     Component: Code,     color: "#84cc16" },
  { name: "FileText", Component: FileText, color: "#a78bfa" },
  { name: "Image",    Component: Image,    color: "#fb923c" },
  { name: "Link",     Component: Link,     color: "#38bdf8" },
  { name: "Bell",     Component: Bell,     color: "#fbbf24" },
  { name: "Check",    Component: Check,    color: "#34d399" },
  { name: "X",        Component: XIcon,    color: "#f87171" },
] as const;

export type IconName = (typeof ICON_OPTIONS)[number]["name"];

// Look up by name for both component and color
const ICON_DEFS = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.name, { Component: o.Component, color: o.color }]),
) as Record<string, { Component: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>; color: string }>;

// ── Color palette ─────────────────────────────────────────────────────────────
export const PRESET_COLORS = [
  { label: "Default", value: "" },
  { label: "Muted",   value: "hsl(var(--muted))" },
  { label: "Blue",    value: "rgba(59,130,246,0.22)" },
  { label: "Green",   value: "rgba(34,197,94,0.22)" },
  { label: "Yellow",  value: "rgba(234,179,8,0.22)" },
  { label: "Orange",  value: "rgba(249,115,22,0.22)" },
  { label: "Red",     value: "rgba(239,68,68,0.22)" },
  { label: "Purple",  value: "rgba(168,85,247,0.22)" },
];

// ── Shapes ────────────────────────────────────────────────────────────────────
export const SHAPE_OPTIONS = [
  { name: "rectangle", Icon: Square,   label: "Rectangle" },
  { name: "circle",    Icon: Circle,   label: "Circle"    },
  { name: "diamond",   Icon: Diamond,  label: "Diamond"   },
  { name: "hexagon",   Icon: Hexagon,  label: "Hexagon"   },
] as const;

export type NodeShape = "rectangle" | "circle" | "diamond" | "hexagon";

// ── Shape style helper ────────────────────────────────────────────────────────
export function getShapeStyle(
  shape?: string,
  color?: string,
): React.CSSProperties {
  const bg = color || "hsl(var(--card))";
  switch (shape) {
    case "circle":
      return { backgroundColor: bg, borderRadius: "50%", overflow: "hidden" };
    case "diamond":
      return {
        backgroundColor: bg,
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        overflow: "hidden",
      };
    case "hexagon":
      return {
        backgroundColor: bg,
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        overflow: "hidden",
      };
    default:
      return { backgroundColor: bg, borderRadius: "var(--radius)", overflow: "hidden" };
  }
}

// ── NodeIcon — renders with the icon's preset color ───────────────────────────
export function NodeIcon({
  name,
  size = 14,
  className,
}: {
  name?: string;
  size?: number;
  className?: string;
}) {
  if (!name) return null;
  const def = ICON_DEFS[name];
  if (!def) return null;
  const { Component, color } = def;
  return <Component size={size} style={{ color }} className={className} />;
}

// ── Toolbar button class ──────────────────────────────────────────────────────
const toolBtn =
  "p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground";

// ── Duplicate ID counter ──────────────────────────────────────────────────────
let _dupCounter = 0;
function dupId() {
  return `dup-${Date.now()}-${++_dupCounter}`;
}

// ── Main toolbar component ────────────────────────────────────────────────────
interface CanvasNodeToolbarProps {
  id: string;
  selected?: boolean;
  secondRow?: React.ReactNode;
}

export function CanvasNodeToolbar({ id, selected, secondRow }: CanvasNodeToolbarProps) {
  const [showIconPicker, setShowIconPicker] = useState(false);

  const {
    getNodes, getEdges,
    deleteElements, setNodes, updateNodeData,
  } = useReactFlow();

  const selectedCount  = useStore((s) => s.nodes.filter((n) => n.selected).length);
  const firstSelectedId = useStore((s) => s.nodes.find((n) => n.selected)?.id);
  const isMultiSelect  = selectedCount > 1;
  const isVisible      = !!selected && (selectedCount === 1 || id === firstSelectedId);

  // Delete
  const handleDelete = useCallback(() => {
    if (isMultiSelect) {
      deleteElements({
        nodes: getNodes().filter((n) => n.selected),
        edges: getEdges().filter((e) => e.selected),
      });
    } else {
      deleteElements({
        nodes: [{ id }],
        edges: getEdges().filter((e) => e.source === id || e.target === id),
      });
    }
  }, [id, isMultiSelect, getNodes, getEdges, deleteElements]);

  // Duplicate
  const handleDuplicate = useCallback(() => {
    const src = isMultiSelect
      ? getNodes().filter((n) => n.selected)
      : getNodes().filter((n) => n.id === id);
    const copies: Node[] = src.map((n) => ({
      ...n,
      id: dupId(),
      position: { x: n.position.x + 30, y: n.position.y + 30 },
      selected: false,
    }));
    setNodes((nds) => [...nds, ...copies]);
  }, [id, isMultiSelect, getNodes, setNodes]);

  // Color
  const handleColor = useCallback(
    (color: string) => {
      if (isMultiSelect) {
        setNodes((nds) =>
          nds.map((n) => (n.selected ? { ...n, data: { ...n.data, color } } : n)),
        );
      } else {
        updateNodeData(id, { color });
      }
    },
    [id, isMultiSelect, setNodes, updateNodeData],
  );

  // Icon
  const handleIcon = useCallback(
    (icon: string) => {
      updateNodeData(id, { icon });
      setShowIconPicker(false);
    },
    [id, updateNodeData],
  );

  // Shape
  const handleShape = useCallback(
    (shape: string) => updateNodeData(id, { shape }),
    [id, updateNodeData],
  );

  return (
    <NodeToolbar isVisible={isVisible} position={Position.Top} offset={8}>
      <div className="relative flex flex-col gap-1">
        {/* Main toolbar row */}
        <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg border bg-background shadow-md">
          {/* Delete */}
          <button
            className={cn(toolBtn, "hover:text-destructive hover:bg-destructive/10")}
            onClick={handleDelete}
            title={isMultiSelect ? "Delete selected" : "Delete node"}
          >
            <Trash2 size={13} />
          </button>

          {!isMultiSelect && (
            <>
              <button className={toolBtn} onClick={handleDuplicate} title="Duplicate">
                <Copy size={13} />
              </button>

              <div className="w-px h-4 bg-border mx-0.5" />

              {SHAPE_OPTIONS.map(({ name, Icon, label }) => (
                <button
                  key={name}
                  className={toolBtn}
                  onClick={() => handleShape(name)}
                  title={`Shape: ${label}`}
                >
                  <Icon size={13} />
                </button>
              ))}

              <div className="w-px h-4 bg-border mx-0.5" />

              <button
                className={cn(toolBtn, showIconPicker && "bg-muted text-foreground")}
                onClick={() => setShowIconPicker((v) => !v)}
                title="Pick icon"
              >
                <Smile size={13} />
              </button>

              <div className="w-px h-4 bg-border mx-0.5" />
            </>
          )}

          {/* Color swatches */}
          {PRESET_COLORS.map((c) => (
            <button
              key={c.label}
              title={`Color: ${c.label}`}
              onClick={() => handleColor(c.value)}
              className="w-3.5 h-3.5 rounded-full border border-border/60 hover:scale-125 transition-transform shrink-0"
              style={{
                backgroundColor: c.value || "hsl(var(--card))",
                boxShadow: "inset 0 0 0 1px hsl(var(--border) / 0.6)",
              }}
            />
          ))}
        </div>

        {/* Second row (e.g. text formatting) */}
        {secondRow && (
          <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg border bg-background shadow-md">
            {secondRow}
          </div>
        )}

        {/* Icon picker — colorful grid */}
        {showIconPicker && !isMultiSelect && (
          <div className="absolute top-full left-0 mt-1.5 p-2 bg-background border rounded-lg shadow-lg z-50 grid grid-cols-4 gap-1 min-w-max">
            {ICON_OPTIONS.map(({ name, Component, color }) => (
              <button
                key={name}
                className="p-1.5 rounded-md hover:scale-110 transition-transform flex items-center justify-center"
                style={{ backgroundColor: `${color}22` }}
                onClick={() => handleIcon(name)}
                title={name}
              >
                <Component size={16} style={{ color }} />
              </button>
            ))}
            {/* Remove icon */}
            <button
              className="p-1.5 rounded-md hover:bg-destructive/10 flex items-center justify-center text-destructive"
              onClick={() => handleIcon("")}
              title="Remove icon"
            >
              <XIcon size={16} />
            </button>
          </div>
        )}
      </div>
    </NodeToolbar>
  );
}
