import { useCallback } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { Image as ImageIcon, FolderOpen } from "lucide-react";
import { cn } from "../../../lib/utils";

export type ImageNodeData = {
  src: string;
  alt: string;
};

export function ImageNode({ id, data, selected }: NodeProps) {
  const nodeData = data as ImageNodeData;
  const { updateNodeData } = useReactFlow();

  const pickImage = useCallback(async () => {
    try {
      // @tauri-apps/plugin-dialog — open file picker
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }],
      });
      if (typeof path === "string" && path) {
        // Use Tauri asset protocol so the webview can load local files
        const src = `asset://localhost/${path.replace(/^\//, "")}`;
        updateNodeData(id, { src, alt: path.split(/[\\/]/).pop() ?? "image" });
      }
    } catch {
      // Tauri not available (dev browser) — fall back to URL prompt
      const url = window.prompt("Enter image URL:");
      if (url) updateNodeData(id, { src: url, alt: "image" });
    }
  }, [id, updateNodeData]);

  return (
    <div
      className={cn(
        "w-[240px] rounded-lg border-2 bg-card text-card-foreground shadow-sm overflow-hidden",
        selected ? "border-primary shadow-md" : "border-border",
      )}
    >
      <Handle type="target" position={Position.Top}    className="!bg-primary/70 !w-2.5 !h-2.5 !border-0" />

      {nodeData.src ? (
        <img
          src={nodeData.src}
          alt={nodeData.alt ?? ""}
          className="w-full max-h-[200px] object-contain bg-muted/30"
          draggable={false}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 h-[120px] bg-muted/30 text-muted-foreground">
          <ImageIcon size={28} strokeWidth={1.5} />
          <span className="text-xs">No image</span>
        </div>
      )}

      <div className="px-3 py-1.5 border-t">
        <button
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          onClick={pickImage}
        >
          <FolderOpen size={11} />
          Change image
        </button>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary/70 !w-2.5 !h-2.5 !border-0" />
    </div>
  );
}
