import { PMTaskStatus } from "../../types/pm";

interface StatusBadgeProps {
  status: PMTaskStatus;
  className?: string;
}

const config: Record<PMTaskStatus, { label: string; className: string }> = {
  new:           { label: "New",           className: "bg-muted text-muted-foreground border-border" },
  active:        { label: "Active",        className: "bg-primary/15 text-primary border-primary/30" },
  ready_to_go:   { label: "Ready to Go",   className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" },
  needs_testing: { label: "Needs Testing", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  resolved:      { label: "Resolved",      className: "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30" },
  rejected:      { label: "Rejected",      className: "bg-destructive/15 text-destructive border-destructive/30" },
  closed:        { label: "Closed",        className: "bg-muted/40 text-muted-foreground/60 border-border/50" },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const { label, className: c } = config[status] ?? config.new;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c} ${className}`}
    >
      {label}
    </span>
  );
}
