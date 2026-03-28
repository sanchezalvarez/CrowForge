import { Layers, Package, BookOpen, CheckSquare2, Bug, Zap, type LucideIcon } from "lucide-react";
import { PMItemType } from "../../types/pm";

const TYPE_CONFIG: Record<PMItemType, { label: string; color: string; icon: LucideIcon }> = {
  epic:    { label: "Epic",    color: "bg-purple-500/15 text-purple-400 border-purple-500/30",     icon: Layers       },
  feature: { label: "Feature", color: "bg-blue-500/15 text-blue-400 border-blue-500/30",           icon: Package      },
  story:   { label: "Story",   color: "bg-green-500/15 text-green-400 border-green-500/30",        icon: BookOpen     },
  task:    { label: "Task",    color: "bg-muted/60 text-muted-foreground border-border",            icon: CheckSquare2 },
  bug:     { label: "Bug",     color: "bg-destructive/15 text-destructive border-destructive/30",  icon: Bug          },
  spike:   { label: "Spike",   color: "bg-amber-500/15 text-amber-400 border-amber-500/30",        icon: Zap          },
};

interface WorkItemTypeBadgeProps {
  type: PMItemType;
  className?: string;
  iconOnly?: boolean;
}

export function WorkItemTypeBadge({ type, className = "", iconOnly = false }: WorkItemTypeBadgeProps) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.task;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border text-[10px] font-medium px-1.5 py-0.5 ${cfg.color} ${className}`}
      title={cfg.label}
    >
      <Icon size={9} strokeWidth={2.2} />
      {!iconOnly && cfg.label}
    </span>
  );
}

export function workItemIcon(type: PMItemType): LucideIcon {
  return (TYPE_CONFIG[type] ?? TYPE_CONFIG.task).icon;
}

export function workItemColor(type: PMItemType): string {
  return (TYPE_CONFIG[type] ?? TYPE_CONFIG.task).color;
}
