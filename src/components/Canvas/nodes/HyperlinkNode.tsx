import { useState, useCallback } from "react";
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer, useStore } from "@xyflow/react";
import { ExternalLink, Link2, Pencil } from "lucide-react";
import { cn } from "../../../lib/utils";
import { getNodeShadow } from "./NodeToolbar";
import { useCanvasExecution } from "../CanvasExecutionContext";

export type HyperlinkNodeData = {
  url:    string;
  title?: string;
  color?: string;
};

export function HyperlinkNode({ id, data, selected }: NodeProps) {
  const nodeData = data as HyperlinkNodeData;
  const { updateNodeData } = useReactFlow();
  const { scheduleSave }   = useCanvasExecution();

  const [editing, setEditing] = useState(false);
  const [urlInput, setUrlInput] = useState(nodeData.url ?? "");
  const [titleInput, setTitleInput] = useState(nodeData.title ?? "");

  const startEdit = useCallback(() => {
    setUrlInput(nodeData.url ?? "");
    setTitleInput(nodeData.title ?? "");
    setEditing(true);
  }, [nodeData.url, nodeData.title]);

  const saveEdit = useCallback(() => {
    setEditing(false);
    updateNodeData(id, { url: urlInput.trim(), title: titleInput.trim() });
    scheduleSave();
  }, [id, urlInput, titleInput, updateNodeData, scheduleSave]);

  const handleOpen = useCallback(() => {
    if (!nodeData.url) return;
    let url = nodeData.url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, [nodeData.url]);

  const isConnecting = useStore((s) => s.connection.inProgress);
  const handleCls = cn(
    "transition-all duration-150",
    (selected || isConnecting) ? "!opacity-100" : "!opacity-0",
  );

  const bg = nodeData.color || "hsl(var(--card))";

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={48}
        lineClassName="!border-primary/60"
        handleClassName="!bg-primary !border-background !w-2 !h-2 !rounded-sm"
      />

      {/* 4 handles */}
      <Handle type="target"  position={Position.Top}    className={handleCls} />
      <Handle type="source"  position={Position.Bottom} className={handleCls} />
      <Handle type="target"  position={Position.Left}   id="left-target"  className={handleCls} />
      <Handle type="source"  position={Position.Right}  id="right-source" className={handleCls} />

      <div className="w-full h-full" style={getNodeShadow(selected)}>
        <div
          className={cn(
            "w-full h-full min-w-[160px] min-h-[48px] flex flex-col rounded-[var(--radius)] overflow-hidden transition-colors",
            selected ? "border-2 border-primary" : "border border-border",
          )}
          style={{ backgroundColor: bg }}
          onDoubleClick={startEdit}
        >
          {editing ? (
            <div className="flex flex-col gap-1 p-2" onKeyDown={(e) => e.stopPropagation()}>
              <input
                autoFocus
                className="w-full text-xs bg-muted/40 border border-border/60 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="URL (e.g. https://example.com)"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <input
                className="w-full text-xs bg-muted/40 border border-border/60 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="Title (optional)"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <div className="flex gap-1 justify-end">
                <button
                  className="text-[11px] px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={saveEdit}
                >
                  Save
                </button>
                <button
                  className="text-[11px] px-2 py-0.5 rounded border hover:bg-muted"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 min-h-[48px] flex-1">
              <Link2 size={14} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                {nodeData.url ? (
                  <>
                    {nodeData.title && (
                      <p className="text-xs font-medium text-foreground truncate leading-snug">
                        {nodeData.title}
                      </p>
                    )}
                    <p className="text-[11px] text-primary truncate leading-snug">
                      {nodeData.url}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Double-click to set URL</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {nodeData.url && (
                  <button
                    className="p-1 rounded hover:bg-muted transition-colors text-primary"
                    onClick={handleOpen}
                    title="Open in new window"
                  >
                    <ExternalLink size={13} />
                  </button>
                )}
                <button
                  className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                  onClick={startEdit}
                  title="Edit URL"
                >
                  <Pencil size={11} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
