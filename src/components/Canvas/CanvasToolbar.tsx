import { useRef, useState, useEffect } from "react";
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
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHelp) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowHelp(false); };
    const onClick = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [showHelp]);

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
    <div className="relative flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0 flex-wrap">
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
          ref={helpRef}
          className="absolute top-12 right-0 z-50 card-riso surface-noise riso-frame rounded-lg p-4 w-72 animate-ink-in"
          style={{ border: "1.5px solid var(--border-strong)", boxShadow: "4px 4px 0 var(--riso-teal)" }}
        >
          {/* Riso strip */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "6px 6px 0 0", background: "var(--riso-strip)", opacity: 0.75 }} />
          <div className="flex items-center justify-between mb-3 mt-1">
            <span className="riso-section-label">
              Keyboard Shortcuts
            </span>
            <button
              className="btn-tactile btn-tactile-outline h-5 w-5 p-0 flex items-center justify-center"
              onClick={() => setShowHelp(false)}
            >
              <X size={12} />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {SHORTCUTS.map(({ key, desc }) => (
              <div key={key} className="flex items-start justify-between gap-3">
                <kbd className="shrink-0 px-1.5 py-0.5 rounded font-mono-ui text-[10px] text-foreground" style={{ background: "var(--background-3)", border: "1px solid var(--border-strong)" }}>
                  {key}
                </kbd>
                <span className="font-mono-ui text-[10px] text-muted-foreground text-right">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
