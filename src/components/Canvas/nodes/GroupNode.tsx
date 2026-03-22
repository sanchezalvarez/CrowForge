import { type NodeProps } from "@xyflow/react";
import { NodeResizer } from "@xyflow/react";
import { cn } from "../../../lib/utils";

export type GroupNodeData = {
  label: string;
};

export function GroupNode({ data, selected }: NodeProps) {
  const nodeData = data as GroupNodeData;

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={100}
        lineClassName="!border-primary"
        handleClassName="!bg-primary !border-background !w-2 !h-2 !rounded-sm"
      />
      <div
        className={cn(
          "w-full h-full rounded-xl border-2 border-dashed bg-muted/20",
          selected ? "border-primary" : "border-border/60",
        )}
      >
        <span className="absolute top-2 left-3 text-xs font-semibold text-muted-foreground select-none">
          {nodeData.label || "Group"}
        </span>
      </div>
    </>
  );
}
