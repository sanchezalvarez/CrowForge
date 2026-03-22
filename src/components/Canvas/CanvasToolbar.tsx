import { useReactFlow } from "@xyflow/react";
import { StickyNote, Bot, Image, Layers, LayoutDashboard, Trash2 } from "lucide-react";
import { applyAutoLayout } from "./utils/autoLayout";
import { cn } from "../../lib/utils";

interface CanvasToolbarProps {
  onAddText: () => void;
  onAddAI: () => void;
  onAddImage: () => void;
  onAddGroup: () => void;
  onClear: () => void;
}

export function CanvasToolbar({
  onAddText,
  onAddAI,
  onAddImage,
  onAddGroup,
  onClear,
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
    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
    "bg-background border text-foreground hover:bg-muted",
  );

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-background shrink-0 flex-wrap">
      <span className="text-xs font-semibold text-muted-foreground mr-1 select-none">Add:</span>

      <button className={btnCls} onClick={onAddText} title="Add text note">
        <StickyNote size={12} />
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

      <button className={btnCls} onClick={onAddGroup} title="Add group">
        <Layers size={12} />
        Group
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button
        className={cn(btnCls, "hover:bg-primary/10 hover:text-primary hover:border-primary/40")}
        onClick={handleAutoLayout}
        title="Auto-layout (dagre TB)"
      >
        <LayoutDashboard size={12} />
        Auto layout
      </button>

      <button
        className={cn(btnCls, "ml-auto hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40")}
        onClick={onClear}
        title="Clear canvas"
      >
        <Trash2 size={12} />
        Clear
      </button>
    </div>
  );
}
