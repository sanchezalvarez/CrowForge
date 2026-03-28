import { useState, useCallback } from "react";
import {
  NodeToolbar,
  Position,
  useReactFlow,
  useStore,
  type Node,
} from "@xyflow/react";
import {
  Trash2, Copy, Smile, Palette,
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

const ICON_DEFS = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.name, { Component: o.Component, color: o.color }]),
) as Record<string, { Component: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>; color: string }>;

// ── Color palette — richer, more saturated ────────────────────────────────────
export const PRESET_COLORS = [
  { label: "Default",  value: "" },
  { label: "Slate",    value: "rgba(100,116,139,0.20)" },
  { label: "Sky",      value: "rgba(14,165,233,0.22)" },
  { label: "Emerald",  value: "rgba(16,185,129,0.22)" },
  { label: "Amber",    value: "rgba(245,158,11,0.22)" },
  { label: "Rose",     value: "rgba(244,63,94,0.22)" },
  { label: "Violet",   value: "rgba(139,92,246,0.22)" },
  { label: "Orange",   value: "rgba(249,115,22,0.22)" },
  { label: "Teal",     value: "rgba(20,184,166,0.22)" },
  { label: "Pink",     value: "rgba(236,72,153,0.22)" },
  { label: "Indigo",   value: "rgba(99,102,241,0.22)" },
  { label: "Lime",     value: "rgba(132,204,22,0.22)" },
];

// Solid background variants for sticky notes / other uses
export const SOLID_COLORS = [
  { label: "Yellow", value: "#fef08a" },
  { label: "Blue",   value: "#bae6fd" },
  { label: "Green",  value: "#bbf7d0" },
  { label: "Pink",   value: "#fecdd3" },
  { label: "Purple", value: "#e9d5ff" },
  { label: "Orange", value: "#fed7aa" },
];

// ── Shapes ────────────────────────────────────────────────────────────────────
export const SHAPE_OPTIONS = [
  { name: "rectangle", Icon: Square,   label: "Rectangle" },
  { name: "circle",    Icon: Circle,   label: "Circle"    },
  { name: "diamond",   Icon: Diamond,  label: "Diamond"   },
  { name: "hexagon",   Icon: Hexagon,  label: "Hexagon"   },
] as const;

export type NodeShape = "rectangle" | "circle" | "diamond" | "hexagon";

// ── Shape style helper — returns styles for the inner content div ──────────────
// Drop shadow is handled by an outer wrapper in each node component.
export function getShapeStyle(
  shape?: string,
  color?: string,
): React.CSSProperties {
  const bg = color || "var(--card)";
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

// Returns CSS filter for drop shadow — works with clipPath shapes
export function getNodeShadow(selected?: boolean): React.CSSProperties {
  if (selected) {
    return {
      filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.18)) drop-shadow(0 1px 4px rgba(0,0,0,0.12))",
    };
  }
  return {
    filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.12)) drop-shadow(0 1px 2px rgba(0,0,0,0.08))",
  };
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
  "p-2 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground";

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
  hideShapes?: boolean;
}

export function CanvasNodeToolbar({ id, selected, secondRow, hideShapes }: CanvasNodeToolbarProps) {
  const [showIconPicker,  setShowIconPicker]  = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [hexInput,        setHexInput]        = useState("");

  const {
    getNodes, getEdges,
    deleteElements, setNodes, updateNodeData,
  } = useReactFlow();

  const selectedCount   = useStore((s) => s.nodes.filter((n) => n.selected).length);
  const firstSelectedId = useStore((s) => s.nodes.find((n) => n.selected)?.id);
  const isMultiSelect   = selectedCount > 1;
  const isVisible       = !!selected && (selectedCount === 1 || id === firstSelectedId);

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
      setShowColorPicker(false);
    },
    [id, isMultiSelect, setNodes, updateNodeData],
  );

  // Hex color input submit
  const handleHexSubmit = useCallback(() => {
    const val = hexInput.trim();
    if (!val) return;
    const hex = val.startsWith("#") ? val : `#${val}`;
    // Basic hex validation: #rgb or #rrggbb
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
      handleColor(hex);
      setHexInput("");
    }
  }, [hexInput, handleColor]);

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
      <div className="relative flex flex-col gap-1.5">
        {/* Main toolbar row */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg border bg-background shadow-lg">
          {/* Delete */}
          <button
            className={cn(toolBtn, "hover:text-destructive hover:bg-destructive/10")}
            onClick={handleDelete}
            title={isMultiSelect ? "Delete selected" : "Delete node"}
          >
            <Trash2 size={15} />
          </button>

          {!isMultiSelect && (
            <>
              <button className={toolBtn} onClick={handleDuplicate} title="Duplicate">
                <Copy size={15} />
              </button>

              <div className="w-px h-5 bg-border mx-0.5" />

              {!hideShapes && SHAPE_OPTIONS.map(({ name, Icon, label }) => (
                <button
                  key={name}
                  className={toolBtn}
                  onClick={() => handleShape(name)}
                  title={`Shape: ${label}`}
                >
                  <Icon size={15} />
                </button>
              ))}

              {!hideShapes && <div className="w-px h-5 bg-border mx-0.5" />}

              {/* Icon picker toggle */}
              <button
                className={cn(toolBtn, showIconPicker && "bg-muted text-foreground")}
                onClick={() => {
                  setShowIconPicker((v) => !v);
                  setShowColorPicker(false);
                }}
                title="Pick icon"
              >
                <Smile size={15} />
              </button>

              <div className="w-px h-5 bg-border mx-0.5" />

              {/* Color picker toggle — single icon */}
              <button
                className={cn(toolBtn, showColorPicker && "bg-muted text-foreground")}
                onClick={() => {
                  setShowColorPicker((v) => !v);
                  setShowIconPicker(false);
                }}
                title="Pick color"
              >
                <Palette size={15} />
              </button>
            </>
          )}

          {/* Multi-select: only color */}
          {isMultiSelect && (
            <button
              className={cn(toolBtn, showColorPicker && "bg-muted text-foreground")}
              onClick={() => setShowColorPicker((v) => !v)}
              title="Pick color"
            >
              <Palette size={15} />
            </button>
          )}
        </div>

        {/* Second row (e.g. text formatting) */}
        {secondRow && (
          <div className="flex items-center gap-0.5 px-2 py-1.5 rounded-lg border bg-background shadow-lg">
            {secondRow}
          </div>
        )}

        {/* Color picker popup */}
        {showColorPicker && (
          <div className="absolute top-full left-0 mt-1.5 p-2.5 bg-background border rounded-lg shadow-xl z-50 min-w-max">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 px-0.5">Color</div>
            <div className="grid grid-cols-6 gap-1.5 mb-2.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.label}
                  title={c.label}
                  onClick={() => handleColor(c.value)}
                  className="w-6 h-6 rounded-full hover:scale-125 transition-transform shrink-0 border border-border/60 relative"
                  style={{
                    backgroundColor: c.value || "var(--card)",
                    boxShadow: c.value ? undefined : "inset 0 0 0 1px var(--border)",
                  }}
                >
                  {!c.value && (
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] text-muted-foreground font-medium">∅</span>
                  )}
                </button>
              ))}
            </div>
            {/* Custom hex input */}
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="color"
                className="w-6 h-6 rounded cursor-pointer border border-border shrink-0 p-0"
                onChange={(e) => setHexInput(e.target.value)}
                title="Pick custom color"
              />
              <input
                type="text"
                placeholder="#hex"
                maxLength={7}
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleHexSubmit();
                  e.stopPropagation();
                }}
                className="w-20 px-1.5 py-1 rounded border border-border text-[11px] bg-muted outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
              <button
                onClick={handleHexSubmit}
                className="px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] font-medium hover:opacity-90"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Icon picker — colorful grid */}
        {showIconPicker && !isMultiSelect && (
          <div className="absolute top-full left-0 mt-1.5 p-2.5 bg-background border rounded-lg shadow-xl z-50 grid grid-cols-4 gap-1 min-w-max">
            <div className="col-span-4 text-[10px] text-muted-foreground uppercase tracking-wider mb-1 px-0.5">Icon</div>
            {ICON_OPTIONS.map(({ name, Component, color }) => (
              <button
                key={name}
                className="p-2 rounded-md hover:scale-110 transition-transform flex items-center justify-center"
                style={{ backgroundColor: `${color}22` }}
                onClick={() => handleIcon(name)}
                title={name}
              >
                <Component size={16} style={{ color }} />
              </button>
            ))}
            {/* Remove icon */}
            <button
              className="p-2 rounded-md hover:bg-destructive/10 flex items-center justify-center text-destructive"
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
