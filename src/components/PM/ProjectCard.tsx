import { KanbanSquare, Bug } from "lucide-react";
import { PMProject } from "../../types/pm";

interface ProjectCardProps {
  project: PMProject;
  onClick: () => void;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: "var(--accent-teal, #0B7268)" }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground font-mono-ui w-7 text-right">{pct}%</span>
    </div>
  );
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const done = project.closed_count ?? 0;
  const total = project.total_count ?? 0;
  const openBugs = project.open_bug_count ?? 0;

  return (
    <div
      onClick={onClick}
      className="group relative bg-background border border-border rounded-xl p-4 cursor-pointer hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
      style={{ boxShadow: `4px 4px 0 ${project.color}33` }}
    >
      {/* Left color strip */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: project.color }} />

      {/* Halftone dot cluster — top right corner */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0, right: 0, width: 72, height: 72, opacity: 0.10,
          backgroundImage: `radial-gradient(circle, ${project.color} 1.6px, transparent 1.6px)`,
          backgroundSize: '9px 9px',
        }}
      />

      <div className="pl-2">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg">{project.icon}</span>
            <div className="min-w-0">
              <h3 className="font-display font-black text-sm text-foreground truncate">{project.name}</h3>
              {project.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono-ui">{project.description}</p>
              )}
            </div>
          </div>
          {openBugs > 0 && (
            <div className="flex items-center gap-1 text-destructive flex-shrink-0" title={`${openBugs} open bug${openBugs > 1 ? "s" : ""}`}>
              <Bug size={12} />
              <span className="text-[10px] font-mono-ui">{openBugs}</span>
            </div>
          )}
        </div>

        <div className="mb-3">
          <ProgressBar done={done} total={total} />
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono-ui text-muted-foreground">
          <span className="flex items-center gap-1 ml-auto">
            <KanbanSquare size={10} />
            {total} items
          </span>
          {done > 0 && <span className="text-teal-600 dark:text-teal-400">{done} closed</span>}
        </div>

        {project.active_sprint && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground font-mono-ui truncate">
              Sprint: {project.active_sprint.name}
              {project.active_sprint.end_date && (
                <> · ends {new Date(project.active_sprint.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
