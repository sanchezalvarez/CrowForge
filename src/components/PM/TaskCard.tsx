import { GripVertical } from "lucide-react";
import { PMTask, PMMember } from "../../types/pm";
import { PriorityBadge } from "./PriorityBadge";
import { MemberAvatar } from "./MemberAvatar";
import { DeadlineWarning } from "./DeadlineWarning";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";

interface TaskCardProps {
  task: PMTask;
  members: PMMember[];
  onClick: () => void;
  dragHandleProps?: Record<string, unknown>;
  compact?: boolean;
}

export function TaskCard({ task, members, onClick, dragHandleProps, compact }: TaskCardProps) {
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));
  const assignee = task.assignee_id ? memberMap[task.assignee_id] : null;

  return (
    <div
      className="group relative bg-background border border-border rounded-lg p-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
    >
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 hover:!opacity-100 cursor-grab active:cursor-grabbing text-muted-foreground transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </div>
      )}

      <div className={dragHandleProps ? "pl-2" : ""}>
        {/* Type badge */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <WorkItemTypeBadge type={task.item_type} />
        </div>

        {/* Title */}
        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 mb-2">{task.title}</p>

        {/* Meta row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <DeadlineWarning dueDate={task.due_date} status={task.status} />
          </div>
          <MemberAvatar member={assignee} size="sm" className="flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}
