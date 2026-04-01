import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { PMProject, PMSprint, PMTask, PMMember } from "../../types/pm";
import { formatDate } from "../../lib/pmUtils";
import { TaskCard } from "./TaskCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { toast } from "../../hooks/useToast";

interface SprintViewProps {
  project: PMProject;
  sprints: PMSprint[];
  tasks: PMTask[];
  members: PMMember[];
  onTaskClick: (task: PMTask) => void;
  onSprintCreate: (data: { project_id: number; name: string; goal: string; start_date: string; end_date: string }) => Promise<PMSprint | null>;
  onSprintComplete: (sprintId: number) => Promise<{ completed: number; moved_to_backlog: number } | null>;
  onTaskUpdate: (id: number, data: Partial<PMTask>) => Promise<PMTask | null>;
}

// formatDate and velocity imported from pmUtils

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div
          className="flex-1 h-2 rounded-sm overflow-hidden"
          style={{ background: "var(--background-3)", border: "1px solid var(--border-strong)" }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${pct}%`, background: "var(--accent-teal)" }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground font-mono-ui">{pct}%</span>
      </div>
      <span className="text-[10px] text-muted-foreground font-mono-ui">{done}/{total} items</span>
    </div>
  );
}


export function SprintView({ project, sprints, tasks, members, onTaskClick, onSprintCreate, onSprintComplete, onTaskUpdate }: SprintViewProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [sprintName, setSprintName] = useState("");
  const [sprintGoal, setSprintGoal] = useState("");
  const [sprintStart, setSprintStart] = useState("");
  const [sprintEnd, setSprintEnd] = useState("");
  const [creating, setCreating] = useState(false);

  const backlogTasks = tasks.filter((t) => !t.sprint_id && t.parent_id === null);

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName.trim()) return;
    setCreating(true);
    try {
      await onSprintCreate({
        project_id: project.id,
        name: sprintName.trim(),
        goal: sprintGoal,
        start_date: sprintStart,
        end_date: sprintEnd,
      });
      setCreateOpen(false);
      setSprintName(""); setSprintGoal(""); setSprintStart(""); setSprintEnd("");
    } finally {
      setCreating(false);
    }
  };

  const handleComplete = async (sprint: PMSprint) => {
    const result = await onSprintComplete(sprint.id);
    if (result) {
      toast(`Sprint completed! ${result.completed} closed, ${result.moved_to_backlog} moved to backlog.`, "success");
    }
  };

  const handleAssignToSprint = async (task: PMTask, sprintId: number | null) => {
    await onTaskUpdate(task.id, { sprint_id: sprintId });
  };

  return (
    <div className="flex flex-col gap-5">
      {sprints.map((sprint, sprintIdx) => {
        const sprintTasks = tasks.filter((t) => t.sprint_id === sprint.id && t.parent_id === null);
        const doneTasks = sprintTasks.filter((t) => t.status === "resolved" || t.status === "closed" || t.status === "rejected");
        const isExpanded = expanded[sprint.id] !== false;

        return (
          <div
            key={sprint.id}
            className="overflow-hidden surface-noise animate-column-in"
            style={{
              animationDelay: `${sprintIdx * 50}ms`,
              border: "1.5px solid rgba(20,16,10,0.18)",
              borderRadius: "8px",
              boxShadow: sprint.status === "active"
                ? "3px 3px 0 var(--riso-orange)"
                : sprint.status === "completed"
                ? "3px 3px 0 var(--riso-teal)"
                : "2px 2px 0 rgba(20,16,10,0.10)",
            }}
          >
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
              style={{ background: "var(--background-2)", borderBottom: isExpanded ? "1px solid rgba(20,16,10,0.10)" : "none" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--background-3)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--background-2)"; }}
              onClick={() => setExpanded((e) => ({ ...e, [sprint.id]: !isExpanded }))}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-black text-sm tracking-tight">{sprint.name}</span>
                  <span className={`text-[10px] font-mono-ui px-1.5 py-0.5 rounded-sm border ${
                    sprint.status === "active"
                      ? "border-orange-500/40 text-orange-700 dark:text-orange-400"
                      : sprint.status === "completed"
                      ? "border-teal-500/40 text-teal-700 dark:text-teal-400"
                      : "text-muted-foreground border-border"
                  }`}
                  style={{
                    background: sprint.status === "active"
                      ? "color-mix(in srgb, var(--accent-orange) 10%, transparent)"
                      : sprint.status === "completed"
                      ? "color-mix(in srgb, var(--accent-teal) 10%, transparent)"
                      : "var(--background-3)",
                  }}
                  >
                    {sprint.status}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono-ui">
                    {formatDate(sprint.start_date)} → {formatDate(sprint.end_date)}
                  </span>
                </div>
                {sprint.goal && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sprint.goal}</p>}
              </div>
              <div className="flex-shrink-0 w-28">
                <ProgressBar done={doneTasks.length} total={sprintTasks.length} />
              </div>
              {sprint.status !== "completed" && (
                <button
                  className="btn-tactile btn-tactile-teal text-[10px]"
                  onClick={(e) => { e.stopPropagation(); handleComplete(sprint); }}
                >
                  Complete
                </button>
              )}
            </div>

            {isExpanded && (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" style={{ background: "var(--background)" }}>
                {sprintTasks.map((task, taskIdx) => (
                  <div key={task.id} className="animate-card-in" style={{ animationDelay: `${taskIdx * 30}ms` }}>
                    <TaskCard
                      task={task}
                      members={members}
                      onClick={() => onTaskClick(task)}
                      compact
                      footer={
                        <button
                          onClick={() => handleAssignToSprint(task, null)}
                          className="btn-tactile btn-tactile-outline w-full justify-center gap-1"
                          style={{ fontSize: 10, color: 'var(--destructive)', borderColor: 'color-mix(in srgb, var(--destructive) 30%, transparent)' }}
                        >
                          Remove from sprint
                        </button>
                      }
                    />
                  </div>
                ))}
                {sprintTasks.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2 col-span-2">No items in this sprint yet.</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {sprints.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No sprints yet. Create your first sprint to get started.
        </div>
      )}

      {/* Backlog */}
      <div
        className="overflow-hidden surface-noise"
        style={{ border: "1.5px solid rgba(20,16,10,0.18)", borderRadius: "8px", boxShadow: "2px 2px 0 rgba(20,16,10,0.10)" }}
      >
        <div
          className="flex items-center gap-2.5 px-4 py-3"
          style={{ background: "var(--background-2)", borderBottom: "1px solid rgba(20,16,10,0.10)" }}
        >
          <span className="font-display font-black text-sm tracking-tight">Backlog</span>
          <span
            className="text-[10px] font-mono-ui px-1.5 py-0.5 rounded-sm"
            style={{ background: "var(--background-3)", border: "1px solid var(--border-strong)", color: "var(--muted-foreground)" }}
          >({backlogTasks.length})</span>
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {backlogTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              members={members}
              onClick={() => onTaskClick(task)}
              compact
              footer={sprints.filter((s) => s.status !== "completed").length > 0 ? (
                <select
                  className="w-full text-[11px] font-mono-ui border rounded px-1.5 py-1 bg-background text-muted-foreground"
                  style={{ borderColor: "rgba(20,16,10,0.15)" }}
                  value=""
                  onChange={(e) => { if (e.target.value) handleAssignToSprint(task, parseInt(e.target.value)); }}
                >
                  <option value="">Add to sprint…</option>
                  {sprints.filter((s) => s.status !== "completed").map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : undefined}
            />
          ))}
          {backlogTasks.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">All items are assigned to sprints.</p>
          )}
        </div>
      </div>

      <button className="btn-tactile btn-tactile-teal self-start" onClick={() => setCreateOpen(true)}>
        <Plus size={12} /> New Sprint
      </button>

      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md surface-noise" style={{ border: "1.5px solid var(--border-strong)" }}>
          <DialogHeader>
            <DialogTitle className="font-display font-black tracking-tight">New Sprint</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSprint} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="font-mono text-xs text-muted-foreground">Sprint name *</Label>
              <input
                className="w-full rounded-md bg-background px-3 py-2 text-sm focus:outline-none"
                style={{ border: "1.5px solid var(--border-strong)" }}
                value={sprintName}
                onChange={(e) => setSprintName(e.target.value)}
                placeholder="Sprint 1"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="font-mono text-xs text-muted-foreground">Goal</Label>
              <input
                className="w-full rounded-md bg-background px-3 py-2 text-sm focus:outline-none"
                style={{ border: "1.5px solid var(--border-strong)" }}
                value={sprintGoal}
                onChange={(e) => setSprintGoal(e.target.value)}
                placeholder="What do you want to achieve?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="font-mono text-xs text-muted-foreground">Start date</Label>
                <input
                  type="date"
                  className="input-riso-date"
                  value={sprintStart}
                  onChange={(e) => setSprintStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="font-mono text-xs text-muted-foreground">End date</Label>
                <input
                  type="date"
                  className="input-riso-date"
                  value={sprintEnd}
                  onChange={(e) => setSprintEnd(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="pt-1">
              <button type="button" className="btn-tactile btn-tactile-outline" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button type="submit" className="btn-tactile btn-tactile-teal" disabled={creating || !sprintName.trim()}>
                {creating ? "Creating…" : "Create Sprint"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
