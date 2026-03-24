import { useReactFlow } from "@xyflow/react";
import {
  Bot, Image, LayoutDashboard, Trash2, Grid3x3,
  StickyNote, Type, Link2, Square,
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
}

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
}: CanvasToolbarProps) {
  const { getNodes, getEdges, setNodes, fitView } = useReactFlow();

  function handleAutoLayout() {
    const nodes = getNodes();
    const edges = getEdges();
    if (!nodes.length) return;
    const laid = applyAutoLayout(nodes, edges);
    setNodes(laid);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }

  const btnCls = cn(
    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all",
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
    </div>
  );
}
