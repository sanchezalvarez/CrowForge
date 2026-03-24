import { useCallback } from "react";
import { Handle, Position, type NodeProps, useReactFlow, NodeResizer } from "@xyflow/react";
import { Image as ImageIcon, FolderOpen } from "lucide-react";
import { cn } from "../../../lib/utils";
import { CanvasNodeToolbar, getShapeStyle, getNodeShadow, NodeIcon } from "./NodeToolbar";

export type ImageNodeData = {
  src:    string;
  alt:    string;
  color?: string;
  icon?:  string;
  shape?: string;
};

export function ImageNode({ id, data, selected }: NodeProps) {
  const nodeData = data as ImageNodeData;
  const { updateNodeData } = useReactFlow();

  const pickImage = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
      });
      if (typeof path === "string" && path) {
        const fileName = path.split(/[\\/]/).pop() ?? "image";
        const ext = fileName.split(".").pop()?.toLowerCase() ?? "png";
        const mimeMap: Record<string, string> = {
          png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
          gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
        };
        const mime = mimeMap[ext] ?? "image/png";

        const { readFile } = await import("@tauri-apps/plugin-fs");
        const bytes = await readFile(path);

        let binary = "";
        const CHUNK = 8192;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        const src = `data:${mime};base64,${btoa(binary)}`;
        updateNodeData(id, { src, alt: fileName });
      }
    } catch (err) {
      console.error("Image pick failed:", err);
      // Fallback: use a styled input rather than window.prompt
      const url = window.prompt("Enter image URL:");
      if (url) updateNodeData(id, { src: url, alt: "image" });
    }
  }, [id, updateNodeData]);

  const shape = nodeData.shape ?? "rectangle";
  const shapeStyle = getShapeStyle(shape, nodeData.color);
  const showBorder = shape === "rectangle" || shape === "circle";

  const handleCls = cn(
    "!bg-primary/70 !w-2.5 !h-2.5 !border-0 transition-opacity duration-150",
    selected ? "!opacity-100" : "!opacity-0",
  );

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={100}
        lineClassName="!border-primary/60"
        handleClassName="!bg-primary !border-background !w-2 !h-2 !rounded-sm"
      />
      <CanvasNodeToolbar id={id} selected={selected} />

      {/* 4 handles — all sides */}
      <Handle type="target"  position={Position.Top}    className={handleCls} />
      <Handle type="source"  position={Position.Bottom} className={handleCls} />
      <Handle type="target"  position={Position.Left}   id="left-target"  className={handleCls} />
      <Handle type="source"  position={Position.Right}  id="right-source" className={handleCls} />

      {/* Drop-shadow wrapper */}
      <div className="w-full h-full" style={getNodeShadow(selected)}>
        <div
          style={shapeStyle}
          className={cn(
            "w-full h-full min-w-[160px] min-h-[100px] text-card-foreground transition-colors flex flex-col",
            showBorder && (selected ? "border-2 border-primary" : "border border-border"),
          )}
        >
          {/* Icon badge (top-left) */}
          <NodeIcon
            name={nodeData.icon}
            size={14}
            className="absolute top-1.5 left-2 text-muted-foreground z-10"
          />

          {nodeData.src ? (
            <img
              src={nodeData.src}
              alt={nodeData.alt ?? ""}
              className="w-full flex-1 object-contain bg-muted/30 min-h-0"
              style={shape !== "rectangle" ? { clipPath: (shapeStyle as any).clipPath, borderRadius: (shapeStyle as any).borderRadius } : {}}
              draggable={false}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 min-h-[120px] flex-1 bg-muted/30 text-muted-foreground">
              <ImageIcon size={28} strokeWidth={1.5} />
              <span className="text-xs">No image</span>
            </div>
          )}

          <div className="px-3 py-1.5 border-t shrink-0">
            <button
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              onClick={pickImage}
            >
              <FolderOpen size={11} />
              Change image
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
