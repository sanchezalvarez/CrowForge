import { useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  Bot, Image, LayoutDashboard, Trash2, Grid3x3,
  StickyNote, Type, Link2, Square, ZoomIn, ZoomOut, Maximize2,
  Download, Upload, Keyboard, X,
} from "lucide-react";
import { applyAutoLayout } from "./utils/autoLayout";
import { cn } from "../../lib/utils";

interface CanvasToolbarProps {
  onAddText:       () => void;
  onAddAI:         () => void;
  onAddImage:      () => void;
  onAddSticky:     () => void;
  onAddAnnotation: () => void;
  onAddHyperlink:  () => void;
  onClear:         () => void;
  snapToGrid:      boolean;
  onSnapToggle:    () => void;
  onImportJSON:    (data: { nodes: unknown[]; edges: unknown[] }) => void;
}

const SHORTCUTS = [
  { key: "Delete / Backspace", desc: "Delete selected nodes/edges" },
  { key: "Ctrl + D",           desc: "Duplicate selected node(s)" },
  { key: "Ctrl + Z",           desc: "Undo" },
  { key: "Ctrl + A",           desc: "Select all" },
  { key: "Ctrl + Shift + F",   desc: "Fit view" },
  { key: "Escape",             desc: "Deselect all" },
  { key: "Double-click edge",  desc: "Edit edge label" },
  { key: "Right-click",        desc: "Context menu" },
];

export function CanvasToolbar({
  onAddText,
  onAddAI,
  onAddImage,
  onAddSticky,
  onAddAnnotation,
  onAddHyperlink,
  onClear,
  snapToGrid,
  onSnapToggle,
  onImportJSON,
}: CanvasToolbarProps) {
  const { getNodes, getEdges, setNodes, fitView, zoomIn, zoomOut, toObject } = useReactFlow();
  const importRef  = useRef<HTMLInputElement>(null);
  const [showHelp, setShowHelp] = useState(false);

  function handleAutoLayout() {
    const nodes = getNodes();
    const edges = getEdges();
    if (!nodes.length) return;
    const laid = applyAutoLayout(nodes, edges);
    setNodes(laid);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }

  function handleExportJSON() {
    const data = toObject();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "canvas.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    importRef.current?.click();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          onImportJSON(parsed);
        } else {
          alert("Invalid canvas JSON: expected { nodes, edges }");
        }
      } catch {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = "";
  }

  const btnCls = cn(
    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
    "bg-background border border-border text-foreground hover:bg-muted hover:shadow-sm active:scale-[0.97]",
  );

  const iconBtn = cn(
    "flex items-center justify-center w-7 h-7 rounded-md text-xs font-medium transition-all",
    "bg-background border border-border text-foreground hover:bg-muted hover:shadow-sm active:scale-[0.97]",
  );

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0 flex-wrap">
      <span className="text-xs font-semibold text-muted-foreground mr-1 select-none uppercase tracking-wider">Add</span>

      <button className={btnCls} onClick={onAddText} title="Add text node">
        <Square size={12} />
        Text
      </button>

      <button className={btnCls} onClick={onAddAI} title="Add AI node">
        <Bot size={12} />
        AI
      </button>

      <button className={btnCls} onClick={onAddImage} title="Add image node">
        <Image size={12} />
        Image
      </button>

      <button className={btnCls} onClick={onAddSticky} title="Add sticky note">
        <StickyNote size={12} />
        Sticky
      </button>

      <button className={btnCls} onClick={onAddAnnotation} title="Add text label (no borders)">
        <Type size={12} />
        Label
      </button>

      <button className={btnCls} onClick={onAddHyperlink} title="Add hyperlink node">
        <Link2 size={12} />
        Link
      </button>

      <div className="w-px h-4 bg-border mx-1" />

      <button
        className={cn(btnCls, "hover:bg-primary/10 hover:text-primary hover:border-primary/30")}
        onClick={handleAutoLayout}
        title="Auto-layout"
      >
        <LayoutDashboard size={12} />
        Auto layout
      </button>

      <button
        className={cn(
          btnCls,
          snapToGrid
            ? "bg-primary/10 text-primary border-primary/40"
            : "hover:bg-primary/10 hover:text-primary hover:border-primary/30",
        )}
        onClick={onSnapToggle}
        title={snapToGrid ? "Snap to grid: ON" : "Snap to grid: OFF"}
      >
        <Grid3x3 size={12} />
        Snap
      </button>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Zoom controls */}
      <button className={iconBtn} onClick={() => zoomIn({ duration: 200 })} title="Zoom in">
        <ZoomIn size={13} />
      </button>
      <button className={iconBtn} onClick={() => zoomOut({ duration: 200 })} title="Zoom out">
        <ZoomOut size={13} />
      </button>
      <button
        className={iconBtn}
        onClick={() => fitView({ padding: 0.2, duration: 400 })}
        title="Fit view"
      >
        <Maximize2 size={13} />
      </button>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Export / Import */}
      <button
        className={cn(iconBtn, "hover:bg-primary/10 hover:text-primary hover:border-primary/30")}
        onClick={handleExportJSON}
        title="Export canvas as JSON"
      >
        <Download size={13} />
      </button>
      <button
        className={cn(iconBtn, "hover:bg-primary/10 hover:text-primary hover:border-primary/30")}
        onClick={handleImportClick}
        title="Import canvas from JSON"
      >
        <Upload size={13} />
      </button>
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Keyboard shortcuts help */}
      <button
        className={cn(iconBtn, showHelp && "bg-primary/10 text-primary border-primary/40")}
        onClick={() => setShowHelp((v) => !v)}
        title="Keyboard shortcuts"
      >
        <Keyboard size={13} />
      </button>

      <button
        className={cn(
          btnCls,
          "ml-auto hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30",
        )}
        onClick={onClear}
        title="Clear canvas"
      >
        <Trash2 size={12} />
        Clear
      </button>

      {/* Shortcuts overlay */}
      {showHelp && (
        <div
          className="absolute top-12 right-4 z-50 bg-background border rounded-lg shadow-xl p-4 w-72"
          style={{ top: 48 }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Keyboard Shortcuts
            </span>
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setShowHelp(false)}
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {SHORTCUTS.map(({ key, desc }) => (
              <div key={key} className="flex items-start justify-between gap-3 text-xs">
                <kbd className="shrink-0 px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono text-foreground">
                  {key}
                </kbd>
                <span className="text-muted-foreground text-right">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
