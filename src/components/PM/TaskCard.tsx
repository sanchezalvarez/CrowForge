import { GripVertical } from "lucide-react";
import { PMTask, PMMember } from "../../types/pm";
import { MemberAvatar } from "./MemberAvatar";
import { DeadlineWarning } from "./DeadlineWarning";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";

interface TaskCardProps {
  task: PMTask;
  members: PMMember[];
  onClick: () => void;
  dragHandleProps?: Record<string, unknown>;
  compact?: boolean;
  footer?: React.ReactNode;
}

export function TaskCard({ task, members, onClick, dragHandleProps, compact, footer }: TaskCardProps) {
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));
  const assignee = task.assignee_id ? memberMap[task.assignee_id] : null;

  return (
    <div
      className={`task-card-riso group relative bg-card surface-noise border rounded-md cursor-pointer transition-all duration-100 ${compact ? "task-card-compact p-2.5" : "p-3.5"}`}
      style={{ borderColor: "rgba(20,16,10,0.18)" }}
      onClick={onClick}
    >
      {/* Assignee in top-right corner for compact mode */}
      {compact && (
        <div className="absolute top-2 right-2">
          <MemberAvatar member={assignee} size="sm" className="flex-shrink-0" />
        </div>
      )}

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
        <div className={`flex items-center gap-1.5 ${compact ? "mb-1" : "mb-2"}`}>
          <WorkItemTypeBadge type={task.item_type} />
        </div>

        {/* Title */}
        <p className={`font-medium text-foreground leading-snug ${compact ? "text-xs line-clamp-1 mb-1.5 pr-7" : "text-sm line-clamp-2 mb-2.5"}`}>{task.title}</p>

        {/* Meta row */}
        {!compact && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <DeadlineWarning dueDate={task.due_date} status={task.status} />
            </div>
            <MemberAvatar member={assignee} size="sm" className="flex-shrink-0" />
          </div>
        )}

        {/* Footer slot (e.g. sprint dropdown) */}
        {footer && (
          <div className={compact ? "mt-1.5" : "mt-2"} onClick={(e) => e.stopPropagation()}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
