import { Clock } from "lucide-react";

interface DeadlineWarningProps {
  dueDate: string | null | undefined;
  status?: string;
}

export function DeadlineWarning({ dueDate, status }: DeadlineWarningProps) {
  if (!dueDate || status === "resolved" || status === "closed" || status === "rejected") return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [dy, dm, dd] = dueDate.split("-").map(Number);
  const due = new Date(dy, dm - 1, dd);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays > 3) return null;

  const isOverdue = diffDays < 0;
  const label = isOverdue
    ? `${Math.abs(diffDays)}d overdue`
    : diffDays === 0
    ? "Due today"
    : `Due in ${diffDays}d`;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-medium ${
        isOverdue ? "text-destructive" : "text-amber-600 dark:text-amber-400"
      }`}
    >
      <Clock size={9} />
      {label}
    </span>
  );
}
