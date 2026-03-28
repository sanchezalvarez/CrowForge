import { PMItemType } from "../../types/pm";

const TYPE_CONFIG: Record<PMItemType, { label: string; color: string }> = {
  epic:    { label: "Epic",    color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  feature: { label: "Feature", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  story:   { label: "Story",   color: "bg-green-500/15 text-green-400 border-green-500/30" },
  task:    { label: "Task",    color: "bg-muted/60 text-muted-foreground border-border" },
  bug:     { label: "Bug",     color: "bg-destructive/15 text-destructive border-destructive/30" },
  spike:   { label: "Spike",   color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

interface WorkItemTypeBadgeProps {
  type: PMItemType;
  className?: string;
}

export function WorkItemTypeBadge({ type, className = "" }: WorkItemTypeBadgeProps) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.task;
  return (
    <span
      className={`inline-flex items-center rounded border text-[10px] font-medium px-1.5 py-0.5 ${cfg.color} ${className}`}
    >
      {cfg.label}
    </span>
  );
}
