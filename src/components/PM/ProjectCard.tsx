import { KanbanSquare, Bug, Trash2 } from "lucide-react";
import { PMProject } from "../../types/pm";

interface ProjectCardProps {
  project: PMProject;
  onClick: () => void;
  onNavigateIssues?: () => void;
  onDelete?: (id: number) => void;
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-background-3 rounded-sm overflow-hidden" style={{ border: "1px solid var(--border-strong)" }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: "var(--accent-teal)" }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground font-mono-ui w-7 text-right">{pct}%</span>
    </div>
  );
}

export function ProjectCard({ project, onClick, onNavigateIssues, onDelete }: ProjectCardProps) {
  const done = project.closed_count ?? 0;
  const total = project.total_count ?? 0;
  const openBugs = project.open_bug_count ?? 0;

  return (
    <div
      onClick={onClick}
      className="group relative bg-card card-riso surface-noise border border-border-strong rounded-lg p-5 cursor-pointer transition-all duration-150 overflow-hidden"
      style={{
        boxShadow: `3px 3px 0 ${project.color}55`,
        border: `1.5px solid rgba(20,16,10,0.18)`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)";
        (e.currentTarget as HTMLElement).style.boxShadow = `5px 5px 0 ${project.color}66`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = `3px 3px 0 ${project.color}55`;
      }}
    >
      {/* Left color strip */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg" style={{ backgroundColor: project.color }} />

      {/* Halftone dot cluster — top right corner */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0, right: 0, width: 72, height: 72, opacity: 0.10,
          backgroundImage: `radial-gradient(circle, ${project.color} 1.6px, transparent 1.6px)`,
          backgroundSize: '9px 9px',
        }}
      />

      <div className="pl-3">
        <div className="flex items-start justify-between gap-3 mb-3">
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
            <div
              className="flex items-center gap-1 text-destructive flex-shrink-0 hover:opacity-70 transition-opacity"
              title={`${openBugs} open bug${openBugs > 1 ? "s" : ""} — click to view`}
              onClick={(e) => { e.stopPropagation(); onNavigateIssues?.(); }}
            >
              <Bug size={12} />
              <span className="text-[10px] font-mono-ui">{openBugs}</span>
            </div>
          )}
        </div>

        <div className="mb-3.5">
          <ProgressBar done={done} total={total} />
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono-ui text-muted-foreground">
          {onDelete && (
            <button
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
              title="Delete project"
              onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
            >
              <Trash2 size={11} />
            </button>
          )}
          <span className="flex items-center gap-1 ml-auto">
            <KanbanSquare size={10} />
            {total} items
          </span>
          {done > 0 && <span className="font-mono-ui" style={{ color: "var(--accent-teal)" }}>{done} closed</span>}
        </div>

        {project.active_sprint && (
          <div className="mt-3 pt-2.5 border-t border-border">
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
