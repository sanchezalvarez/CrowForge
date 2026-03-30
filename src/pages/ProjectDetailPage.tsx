import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Plus, LayoutList, LayoutGrid, Zap, AlertTriangle, X, Sparkles, Radio } from "lucide-react";
import axios from "axios";
import { useTasks } from "../hooks/useTasks";
import { useSprints } from "../hooks/useSprints";
import { PMProject, PMTask, PMTaskStatus, PMItemType, PMMember, PMSuggestedTask } from "../types/pm";
import { BacklogView } from "../components/PM/BacklogView";
import { KanbanBoard } from "../components/PM/KanbanBoard";
import { SprintView } from "../components/PM/SprintView";
import { TaskDetailPanel } from "../components/PM/TaskDetailPanel";
import { TaskForm } from "../components/PM/TaskForm";
import { AIStandup } from "../components/PM/AIStandup";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { toast } from "../hooks/useToast";

const API_BASE = "http://127.0.0.1:8000";
const LS_VIEW_KEY = (id: number) => `pm_view_${id}`;
const LS_DISMISSED_KEY = () => `pm_deadline_dismissed_${new Date().toISOString().slice(0, 10)}`;

interface ProjectDetailPageProps {
  projectId: number;
  onBack: () => void;
  onNavigate?: (page: string, id?: string) => void;
}

export function ProjectDetailPage({ projectId, onBack, onNavigate }: ProjectDetailPageProps) {
  const { tasks, loading: tasksLoading, load: loadTasks, create: createTask, update: updateTask, remove: removeTask, reorder: reorderTasks } = useTasks(projectId);
  const { sprints, create: createSprint, completeSprint } = useSprints(projectId);

  const [project, setProject] = useState<PMProject | null>(null);
  const [members, setMembers] = useState<PMMember[]>([]);
  const [activeView, setActiveView] = useState<string>(() => {
    const saved = localStorage.getItem(LS_VIEW_KEY(projectId)) ?? "backlog";
    // Migrate old "list" → "backlog"
    return saved === "list" ? "backlog" : saved;
  });
  const [selectedTask, setSelectedTask] = useState<PMTask | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskFormStatus, setTaskFormStatus] = useState<PMTaskStatus>("new");
  const [taskFormRestrict, setTaskFormRestrict] = useState(false);
  const [deadlineDismissed, setDeadlineDismissed] = useState(() => !!localStorage.getItem(LS_DISMISSED_KEY()));
  const [standupOpen, setStandupOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestContext, setSuggestContext] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<PMSuggestedTask[]>([]);

  const loadProject = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/pm/projects`);
      const found = res.data.find((p: PMProject) => p.id === projectId);
      if (found) setProject(found);
    } catch {}
  }, [projectId]);

  const loadMembers = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/pm/members`);
      setMembers(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    loadProject();
    loadMembers();
  }, [loadProject, loadMembers]);

  useEffect(() => {
    localStorage.setItem(LS_VIEW_KEY(projectId), activeView);
  }, [activeView, projectId]);

  // Deadline warning
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== "resolved" && t.status !== "closed" && t.status !== "rejected");
  const dueSoonTasks = tasks.filter((t) => {
    if (!t.due_date || t.status === "resolved" || t.status === "closed" || t.status === "rejected") return false;
    const diff = (new Date(t.due_date + "T00:00:00").getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 2;
  });
  const showDeadlineWarning = !deadlineDismissed && (overdueTasks.length > 0 || dueSoonTasks.length > 0);

  const dismissDeadline = () => {
    localStorage.setItem(LS_DISMISSED_KEY(), "1");
    setDeadlineDismissed(true);
  };

  // Stats
  const typeCounts = tasks.reduce((acc, t) => {
    acc[t.item_type] = (acc[t.item_type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const openBugs = tasks.filter((t) => t.item_type === "bug" && t.status !== "resolved" && t.status !== "closed").length;
  const totalSP = tasks.reduce((s, t) => s + (t.story_points ?? 0), 0);

  const handleTaskClick = (task: PMTask) => {
    setSelectedTask(task);
    setPanelOpen(true);
  };

  const handleTaskCreate = (status: PMTaskStatus, restrict = false) => {
    setTaskFormStatus(status);
    setTaskFormRestrict(restrict);
    setTaskFormOpen(true);
  };

  const handleFormSubmit = async (data: Partial<PMTask>) => {
    await createTask({ ...data, project_id: projectId } as PMTask & { project_id: number; title: string });
    await loadProject();
  };

  const handleChildCreate = async (parentId: number, title: string, type: PMItemType) => {
    await createTask({ project_id: projectId, parent_id: parentId, title, item_type: type, status: "new", priority: "medium" } as PMTask & { project_id: number; title: string });
    await loadProject();
  };

  const handleTaskUpdate = async (id: number, data: Partial<PMTask>) => {
    const result = await updateTask(id, data);
    await loadProject();
    if (selectedTask?.id === id && result) setSelectedTask(result);
    return result;
  };

  const handleTaskDelete = async (id: number) => {
    await removeTask(id);
    setPanelOpen(false);
    await loadProject();
  };

  const handleStatusChange = async (taskId: number, newStatus: PMTaskStatus) => {
    await updateTask(taskId, { status: newStatus });
  };

  const handleSuggestTasks = async () => {
    setSuggestLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/pm/ai/suggest-tasks`, {
        project_id: projectId,
        context: suggestContext,
      });
      setSuggestedTasks(res.data.tasks ?? []);
    } catch {
      toast("Failed to get suggestions", "error");
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleAddSuggestedTask = async (suggested: PMSuggestedTask) => {
    await createTask({
      project_id: projectId,
      title: suggested.title,
      priority: suggested.priority,
      item_type: suggested.item_type ?? "task",
      story_points: suggested.story_points ?? null,
      status: "new",
      description: "",
      assignee_id: null,
      due_date: null,
      sprint_id: null,
      parent_id: null,
      labels: [],
    } as unknown as PMTask & { project_id: number; title: string });
    setSuggestedTasks((prev) => prev.filter((t) => t.title !== suggested.title));
    await loadProject();
  };

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Projects
        </button>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{project.icon}</span>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
          <h1 className="font-semibold text-sm text-foreground truncate">{project.name}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setStandupOpen(true)}>
            <Radio size={11} /> Standup
          </Button>
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setSuggestOpen(true)}>
            <Sparkles size={11} /> Suggest
          </Button>
          <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => handleTaskCreate("new", true)}>
            <Plus size={12} /> New Item
          </Button>
        </div>
      </div>

      {/* Stats header */}
      <div className="flex items-center gap-4 px-6 py-2 border-b border-border bg-muted/20 flex-shrink-0 flex-wrap">
        <span className="text-xs text-muted-foreground font-mono">{tasks.length} items</span>
        {Object.entries(typeCounts).map(([type, count]) => (
          <span key={type} className="text-xs font-mono text-muted-foreground">
            {type}: <span className="text-foreground">{count}</span>
          </span>
        ))}
        {totalSP > 0 && (
          <span className="text-xs font-mono text-muted-foreground">SP: <span className="text-foreground">{totalSP}</span></span>
        )}
        {openBugs > 0 && (
          <span className="text-xs font-mono text-destructive font-semibold">{openBugs} open bug{openBugs > 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Deadline warning */}
      {showDeadlineWarning && (
        <div className="flex items-center gap-2 px-6 py-2 bg-destructive/5 border-b border-destructive/20 text-sm text-destructive flex-shrink-0">
          <AlertTriangle size={14} className="flex-shrink-0" />
          <span>
            {overdueTasks.length > 0 && `${overdueTasks.length} item${overdueTasks.length > 1 ? "s" : ""} overdue`}
            {overdueTasks.length > 0 && dueSoonTasks.length > 0 && " · "}
            {dueSoonTasks.length > 0 && `${dueSoonTasks.length} due within 2 days`}
          </span>
          <button onClick={dismissDeadline} className="ml-auto hover:bg-destructive/10 rounded p-0.5 transition-colors">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeView} onValueChange={setActiveView} className="h-full flex flex-col">
          <div className="px-6 pt-3 pb-0 flex-shrink-0 border-b border-border">
            <TabsList className="h-8">
              <TabsTrigger value="backlog" className="gap-1 text-xs h-7">
                <LayoutList size={12} /> Backlog
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1 text-xs h-7">
                <LayoutGrid size={12} /> Kanban
              </TabsTrigger>
              <TabsTrigger value="sprint" className="gap-1 text-xs h-7">
                <Zap size={12} /> Sprints
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="backlog" className="h-full overflow-y-auto px-6 py-4 mt-0 flex flex-col gap-4">
              {tasksLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : (
                <BacklogView
                  tasks={tasks}
                  members={members}
                  onTaskClick={handleTaskClick}
                  onTaskCreate={handleTaskCreate}
                  onTaskUpdate={handleTaskUpdate}
                  onTaskDelete={handleTaskDelete}
                  onTasksReload={loadTasks}
                  onChildCreate={handleChildCreate}
                />
              )}
            </TabsContent>

            <TabsContent value="kanban" className="h-full overflow-hidden px-6 py-4 mt-0">
              <KanbanBoard
                tasks={tasks}
                members={members}
                onTaskClick={handleTaskClick}
                onStatusChange={handleStatusChange}
                onReorder={reorderTasks}
                onTaskCreate={handleTaskCreate}
              />
            </TabsContent>

            <TabsContent value="sprint" className="h-full overflow-y-auto px-6 py-4 mt-0">
              <SprintView
                project={project}
                sprints={sprints}
                tasks={tasks}
                members={members}
                onTaskClick={handleTaskClick}
                onSprintCreate={createSprint}
                onSprintComplete={async (id) => {
                  const result = await completeSprint(id);
                  await loadTasks();
                  return result;
                }}
                onTaskUpdate={handleTaskUpdate}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
        members={members}
        sprints={sprints}
        allTasks={tasks}
        onNavigate={onNavigate}
      />

      {/* Task Form Dialog */}
      <TaskForm
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={{ status: taskFormStatus }}
        members={members}
        sprints={sprints}
        projectId={projectId}
        restrictTypes={taskFormRestrict}
      />

      {/* Standup Dialog */}
      <Dialog open={standupOpen} onOpenChange={setStandupOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio size={14} className="text-primary" /> Daily Standup
            </DialogTitle>
          </DialogHeader>
          <AIStandup projectId={projectId} />
        </DialogContent>
      </Dialog>

      {/* AI Suggest Tasks Dialog */}
      <Dialog open={suggestOpen} onOpenChange={(o) => { if (!o) { setSuggestOpen(false); setSuggestedTasks([]); setSuggestContext(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary" /> AI Work Item Suggestions
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            {suggestedTasks.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">Describe what you're building and AI will suggest work items.</p>
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none h-24"
                  value={suggestContext}
                  onChange={(e) => setSuggestContext(e.target.value)}
                  placeholder="e.g. A mobile app for tracking workouts with social features…"
                />
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setSuggestOpen(false)}>Cancel</Button>
                  <Button onClick={handleSuggestTasks} disabled={suggestLoading} className="gap-1">
                    <Sparkles size={12} />
                    {suggestLoading ? "Thinking…" : "Suggest Items"}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Click to add items to your project:</p>
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                  {suggestedTasks.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => handleAddSuggestedTask(t)}
                      className="flex items-start gap-3 text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/30 transition-colors"
                    >
                      <Plus size={14} className="mt-0.5 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {t.item_type} · {t.priority} priority{t.story_points ? ` · ${t.story_points} SP` : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => { setSuggestedTasks([]); setSuggestContext(""); }}>Back</Button>
                  <Button onClick={() => { setSuggestOpen(false); setSuggestedTasks([]); setSuggestContext(""); }}>Done</Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
