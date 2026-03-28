import { PMPriority } from "../../types/pm";

interface PriorityBadgeProps {
  priority: PMPriority;
  className?: string;
}

const config: Record<PMPriority, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-primary/15 text-primary border-primary/30" },
  high:     { label: "High",     className: "bg-destructive/15 text-destructive border-destructive/30" },
  medium:   { label: "Medium",   className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  low:      { label: "Low",      className: "bg-muted text-muted-foreground border-border" },
};

export function PriorityBadge({ priority, className = "" }: PriorityBadgeProps) {
  const { label, className: c } = config[priority] ?? config.medium;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono border ${c} ${className}`}
    >
      {label}
    </span>
  );
}
