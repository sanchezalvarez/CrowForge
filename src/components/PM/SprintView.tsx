import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, CheckCircle2, Circle } from "lucide-react";
import { PMProject, PMSprint, PMTask, PMMember } from "../../types/pm";
import { Button } from "../ui/button";
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

function formatDate(d: string | null | undefined) {
  if (!d) return "–";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ProgressBar({ done, total, doneSP, totalSP }: { done: number; total: number; doneSP: number; totalSP: number }) {
  const useSP = totalSP > 0;
  const pct = useSP
    ? (totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0)
    : (total > 0 ? Math.round((done / total) * 100) : 0);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{pct}%</span>
      </div>
      {useSP ? (
        <span className="text-[10px] text-muted-foreground font-mono">{doneSP}/{totalSP} SP</span>
      ) : (
        <span className="text-[10px] text-muted-foreground font-mono">{done}/{total} items</span>
      )}
    </div>
  );
}

function velocity(sprint: PMSprint): string {
  if (!sprint.start_date || !sprint.end_date || !sprint.done_sp) return "";
  const days = Math.max(1, (new Date(sprint.end_date).getTime() - new Date(sprint.start_date).getTime()) / (1000 * 60 * 60 * 24));
  const v = ((sprint.done_sp ?? 0) / days * 7).toFixed(1);
  return `${v} SP/week`;
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
    <div className="flex flex-col gap-4">
      {sprints.map((sprint) => {
        const sprintTasks = tasks.filter((t) => t.sprint_id === sprint.id && t.parent_id === null);
        const doneTasks = sprintTasks.filter((t) => t.status === "resolved" || t.status === "closed" || t.status === "rejected");
        const totalSP = sprintTasks.reduce((s, t) => s + (t.story_points ?? 0), 0);
        const doneSP = doneTasks.reduce((s, t) => s + (t.story_points ?? 0), 0);
        const isExpanded = expanded[sprint.id] !== false;
        const vel = velocity({ ...sprint, done_sp: doneSP });

        return (
          <div key={sprint.id} className="border border-border rounded-lg overflow-hidden">
            <div
              className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setExpanded((e) => ({ ...e, [sprint.id]: !isExpanded }))}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{sprint.name}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    sprint.status === "active" ? "bg-primary/10 text-primary border-primary/30" :
                    sprint.status === "completed" ? "bg-teal-500/10 text-teal-600 border-teal-500/30" :
                    "bg-muted text-muted-foreground border-border"
                  }`}>
                    {sprint.status}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatDate(sprint.start_date)} → {formatDate(sprint.end_date)}
                  </span>
                  {vel && <span className="text-[10px] text-muted-foreground font-mono">{vel}</span>}
                </div>
                {sprint.goal && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sprint.goal}</p>}
              </div>
              <div className="flex-shrink-0 w-28">
                <ProgressBar done={doneTasks.length} total={sprintTasks.length} doneSP={doneSP} totalSP={totalSP} />
              </div>
              {sprint.status !== "completed" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={(e) => { e.stopPropagation(); handleComplete(sprint); }}
                >
                  Complete
                </Button>
              )}
            </div>

            {isExpanded && (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sprintTasks.map((task) => {
                  const isDone = task.status === "resolved" || task.status === "closed";
                  return (
                    <div key={task.id} className="flex items-start gap-2">
                      <button
                        onClick={() => handleAssignToSprint(task, null)}
                        className="mt-1 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        title="Remove from sprint"
                      >
                        {isDone ? <CheckCircle2 size={14} className="text-teal-500" /> : <Circle size={14} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <TaskCard task={task} members={members} onClick={() => onTaskClick(task)} compact />
                      </div>
                    </div>
                  );
                })}
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
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/20">
          <span className="text-sm font-semibold">Backlog</span>
          <span className="text-xs text-muted-foreground font-mono">({backlogTasks.length})</span>
          {backlogTasks.length > 0 && (
            <span className="text-xs text-muted-foreground font-mono ml-1">
              · {backlogTasks.reduce((s, t) => s + (t.story_points ?? 0), 0)} SP
            </span>
          )}
        </div>
        <div className="p-3 flex flex-col gap-2">
          {backlogTasks.map((task) => (
            <div key={task.id} className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <TaskCard task={task} members={members} onClick={() => onTaskClick(task)} compact />
              </div>
              {sprints.filter((s) => s.status !== "completed").length > 0 && (
                <select
                  className="text-xs border border-border rounded px-1 py-1 bg-background text-muted-foreground h-7 flex-shrink-0"
                  value=""
                  onChange={(e) => { if (e.target.value) handleAssignToSprint(task, parseInt(e.target.value)); }}
                >
                  <option value="">Add to sprint…</option>
                  {sprints.filter((s) => s.status !== "completed").map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
          {backlogTasks.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">All items are assigned to sprints.</p>
          )}
        </div>
      </div>

      <Button variant="outline" className="self-start" onClick={() => setCreateOpen(true)}>
        <Plus size={14} className="mr-1" /> New Sprint
      </Button>

      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Sprint</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSprint} className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1">
              <Label>Sprint name *</Label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={sprintName}
                onChange={(e) => setSprintName(e.target.value)}
                placeholder="Sprint 1"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Goal</Label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={sprintGoal}
                onChange={(e) => setSprintGoal(e.target.value)}
                placeholder="What do you want to achieve?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label>Start date</Label>
                <input
                  type="date"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={sprintStart}
                  onChange={(e) => setSprintStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>End date</Label>
                <input
                  type="date"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  value={sprintEnd}
                  onChange={(e) => setSprintEnd(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating || !sprintName.trim()}>
                {creating ? "Creating…" : "Create Sprint"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
