import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { PMTask, PMTaskStatus, PMMember } from "../../types/pm";
import { TaskCard } from "./TaskCard";

interface TaskListProps {
  tasks: PMTask[];
  members: PMMember[];
  onTaskClick: (task: PMTask) => void;
  onTaskCreate: (status: PMTaskStatus) => void;
}

const STATUS_ORDER: PMTaskStatus[] = ["new", "active", "resolved", "closed"];
const STATUS_LABELS: Record<PMTaskStatus, string> = {
  new: "New",
  active: "Active",
  resolved: "Resolved",
  closed: "Closed",
};
const STATUS_COLORS: Record<PMTaskStatus, string> = {
  new: "bg-muted-foreground/30",
  active: "bg-primary",
  resolved: "bg-teal-500",
  closed: "bg-muted-foreground/50",
};

export function TaskList({ tasks, members, onTaskClick, onTaskCreate }: TaskListProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ closed: true });

  const grouped = STATUS_ORDER.reduce(
    (acc, s) => ({ ...acc, [s]: tasks.filter((t) => t.status === s) }),
    {} as Record<PMTaskStatus, PMTask[]>
  );

  return (
    <div className="flex flex-col gap-2">
      {STATUS_ORDER.map((status) => {
        const group = grouped[status];
        const isCollapsed = !!collapsed[status];

        return (
          <div key={status} className="rounded-lg border border-border overflow-hidden">
            {/* Section header */}
            <button
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
              onClick={() => setCollapsed((c) => ({ ...c, [status]: !c[status] }))}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[status]}`} />
              <span className="text-sm font-semibold text-foreground">{STATUS_LABELS[status]}</span>
              <span className="text-xs text-muted-foreground font-mono ml-1">({group.length})</span>
              <span className="ml-auto text-muted-foreground">
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>

            {/* Task rows */}
            {!isCollapsed && (
              <div className="divide-y divide-border">
                {group.map((task) => (
                  <div key={task.id} className="px-3 py-2 hover:bg-muted/20 transition-colors">
                    <TaskCard
                      task={task}
                      members={members}
                      onClick={() => onTaskClick(task)}
                      compact
                    />
                  </div>
                ))}
                {/* Add task inline */}
                <button
                  onClick={() => onTaskCreate(status)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  <Plus size={12} /> Add task
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
