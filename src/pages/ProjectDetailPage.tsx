import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Plus, LayoutList, LayoutGrid, Zap, AlertTriangle, X, Sparkles, Radio, Calendar } from "lucide-react";
import axios from "axios";
import { useTasks } from "../hooks/useTasks";
import { useSprints } from "../hooks/useSprints";
import { PMProject, PMTask, PMTaskStatus, PMItemType, PMMember, PMSuggestedTask } from "../types/pm";
import { BacklogView } from "../components/PM/BacklogView";
import { KanbanBoard } from "../components/PM/KanbanBoard";
import { SprintView } from "../components/PM/SprintView";
import { RoadmapView } from "../components/PM/RoadmapView";
import { TaskDetailPanel } from "../components/PM/TaskDetailPanel";
import { TaskForm } from "../components/PM/TaskForm";
import { AIStandup } from "../components/PM/AIStandup";
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
    await createTask({ project_id: projectId, parent_id: parentId, title, item_type: type, status: "new" } as PMTask & { project_id: number; title: string });
    await loadProject();
  };

  const handleTaskUpdate = async (id: number, data: Partial<PMTask>) => {
    const result = await updateTask(id, data);
    await loadProject();
    if (selectedTask?.id === id && result) setSelectedTask(result);
    return result;
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleTaskDelete = async (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmTaskDelete = async () => {
    if (!deleteConfirmId) return;
    await removeTask(deleteConfirmId);
    setPanelOpen(false);
    setDeleteConfirmId(null);
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
      item_type: suggested.item_type ?? "task",
      status: "new",
      description: "",
      assignee_id: null,
      due_date: null,
      sprint_id: null,
      parent_id: null,
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
    <div className="flex-1 flex flex-col h-full overflow-hidden pm-surface" style={{ position: "relative" }}>
      {/* Riso background graphics */}
      <div
        className="pointer-events-none select-none"
        style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden" }}
      >
        {/* Blob — teal, top-right */}
        <div
          className="animate-blob-drift"
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "var(--accent-teal)",
            opacity: 0.07,
            mixBlendMode: "multiply",
            top: -180,
            right: -180,
          }}
        />
        {/* Blob — orange, bottom-left */}
        <div
          className="animate-blob-drift-b"
          style={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "var(--accent-orange)",
            opacity: 0.07,
            mixBlendMode: "multiply",
            bottom: -140,
            left: -140,
          }}
        />
        {/* Blob — violet, mid-right */}
        <div
          className="animate-blob-drift-c"
          style={{
            position: "absolute",
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "var(--accent-violet)",
            opacity: 0.06,
            mixBlendMode: "multiply",
            top: "40%",
            right: -80,
          }}
        />
        {/* Registration crosshair — top-right */}
        <svg
          style={{ position: "absolute", top: 12, right: 12, width: 44, height: 44 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <line x1="4" y1="18" x2="26" y2="18" stroke="rgba(11,114,104,0.38)" strokeWidth="1.5" />
          <line x1="15" y1="7" x2="15" y2="29" stroke="rgba(11,114,104,0.38)" strokeWidth="1.5" />
          <circle cx="15" cy="18" r="5" stroke="rgba(11,114,104,0.26)" strokeWidth="1" fill="none" />
        </svg>
        {/* Registration crosshair — bottom-left */}
        <svg
          style={{ position: "absolute", bottom: 12, left: 12, width: 44, height: 44 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <line x1="4" y1="26" x2="26" y2="26" stroke="rgba(224,78,14,0.38)" strokeWidth="1.5" />
          <line x1="15" y1="15" x2="15" y2="37" stroke="rgba(224,78,14,0.38)" strokeWidth="1.5" />
          <circle cx="15" cy="26" r="5" stroke="rgba(224,78,14,0.26)" strokeWidth="1" fill="none" />
        </svg>
        {/* Halftone cluster — bottom-right */}
        <svg
          style={{ position: "absolute", right: 52, bottom: 60, width: 76, height: 76 }}
          viewBox="0 0 76 76"
          xmlns="http://www.w3.org/2000/svg"
        >
          {(
            [
              [10, 10, 2.2],
              [24, 8, 1.5],
              [6, 24, 1.8],
              [20, 22, 1.3],
              [34, 14, 1.4],
              [38, 28, 1.0],
              [10, 36, 1.3],
              [28, 34, 0.9],
              [42, 42, 0.8],
            ] as [number, number, number][]
          ).map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="rgba(224,78,14,0.22)" />
          ))}
        </svg>
      </div>

      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-6 py-3.5 flex-shrink-0 surface-noise"
        style={{
          position: "relative",
          zIndex: 1,
          borderBottom: "1.5px solid rgba(20,16,10,0.14)",
          background: "var(--background-2)",
        }}
      >
        <button
          onClick={onBack}
          className="btn-tactile btn-tactile-outline gap-1"
        >
          <ChevronLeft size={12} /> Projects
        </button>
        <div className="w-px h-4" style={{ background: "rgba(20,16,10,0.18)" }} />
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{project.icon}</span>
          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: project.color, border: "1px solid rgba(20,16,10,0.20)" }} />
          <h1 className="font-display font-black text-sm text-foreground truncate tracking-tight">{project.name}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="btn-tactile btn-tactile-teal gap-1" onClick={() => setStandupOpen(true)}>
            <Radio size={11} /> Standup
          </button>
          <button className="btn-tactile btn-tactile-violet gap-1" onClick={() => setSuggestOpen(true)}>
            <Sparkles size={11} /> Suggest
          </button>
          <button className="btn-tactile btn-tactile-orange gap-1" onClick={() => handleTaskCreate("new", true)}>
            <Plus size={12} /> New Item
          </button>
        </div>
      </div>

      {/* Stats header */}
      <div
        className="flex items-center gap-3 px-6 py-2.5 flex-shrink-0 flex-wrap"
        style={{ position: "relative", zIndex: 1, borderBottom: "1px solid rgba(20,16,10,0.10)", background: "var(--background)" }}
      >
        <span
          className="text-[10px] font-mono-ui px-1.5 py-0.5 rounded-sm"
          style={{ background: "var(--background-3)", border: "1px solid var(--border-strong)", color: "var(--muted-foreground)" }}
        >{tasks.length} items</span>
        {Object.entries(typeCounts).map(([type, count]) => (
          <span key={type} className="text-[10px] font-mono-ui" style={{ color: "var(--muted-foreground)" }}>
            {type}: <span style={{ color: "var(--foreground)", fontWeight: 700 }}>{count}</span>
          </span>
        ))}
        {openBugs > 0 && (
          <span
            className="text-[10px] font-mono-ui font-bold cursor-pointer hover:underline"
            onClick={() => onNavigate?.("issues")}
            title="View in Issue Tracker"
            style={{ color: "var(--destructive)" }}
          >{openBugs} open bug{openBugs > 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Deadline warning — riso styled */}
      {showDeadlineWarning && (
        <div
          className="flex items-center gap-2 px-6 py-2.5 text-xs font-mono-ui flex-shrink-0"
          style={{
            position: "relative",
            zIndex: 1,
            background: "color-mix(in srgb, var(--destructive) 8%, var(--background))",
            borderBottom: "1.5px solid color-mix(in srgb, var(--destructive) 30%, transparent)",
            color: "var(--destructive)",
          }}
        >
          <AlertTriangle size={13} className="flex-shrink-0" />
          <span>
            {overdueTasks.length > 0 && `${overdueTasks.length} item${overdueTasks.length > 1 ? "s" : ""} overdue`}
            {overdueTasks.length > 0 && dueSoonTasks.length > 0 && " · "}
            {dueSoonTasks.length > 0 && `${dueSoonTasks.length} due within 2 days`}
          </span>
          <button
            onClick={dismissDeadline}
            className="ml-auto rounded p-0.5 transition-colors"
            style={{ border: "1px solid rgba(220,38,38,0.25)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.10)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden" style={{ position: "relative", zIndex: 1 }}>
        <Tabs value={activeView} onValueChange={setActiveView} className="h-full flex flex-col">
          <div
            className="px-6 pt-3.5 pb-0 flex-shrink-0"
            style={{ borderBottom: "1.5px solid rgba(20,16,10,0.14)", background: "var(--background)" }}
          >
            <TabsList className="h-8" style={{ background: "var(--background-3)", border: "1.5px solid rgba(20,16,10,0.16)" }}>
              <TabsTrigger value="backlog" className="gap-1 text-[11px] h-7 font-mono-ui">
                <LayoutList size={12} /> Backlog
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1 text-[11px] h-7 font-mono-ui">
                <LayoutGrid size={12} /> Kanban
              </TabsTrigger>
              <TabsTrigger value="sprint" className="gap-1 text-[11px] h-7 font-mono-ui">
                <Zap size={12} /> Sprints
              </TabsTrigger>
              <TabsTrigger value="roadmap" className="gap-1 text-[11px] h-7 font-mono-ui">
                <Calendar size={12} /> Roadmap
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

            <TabsContent value="roadmap" className="h-full overflow-y-auto px-6 py-4 mt-0">
              <RoadmapView
                tasks={tasks}
                members={members}
                onTaskClick={handleTaskClick}
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
        <DialogContent className="max-w-2xl surface-noise" style={{ border: "1.5px solid var(--border-strong)" }}>
          <DialogHeader>
            <DialogTitle className="font-display font-black flex items-center gap-2 tracking-tight">
              <Radio size={14} style={{ color: "var(--accent-teal)" }} /> Daily Standup
            </DialogTitle>
          </DialogHeader>
          <AIStandup projectId={projectId} />
        </DialogContent>
      </Dialog>

      {/* AI Suggest Tasks Dialog */}
      <Dialog open={suggestOpen} onOpenChange={(o) => { if (!o) { setSuggestOpen(false); setSuggestedTasks([]); setSuggestContext(""); } }}>
        <DialogContent className="max-w-lg surface-noise" style={{ border: "1.5px solid var(--border-strong)" }}>
          <DialogHeader>
            <DialogTitle className="font-display font-black flex items-center gap-2 tracking-tight">
              <Sparkles size={14} style={{ color: "var(--accent-violet)" }} /> AI Work Item Suggestions
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {suggestedTasks.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">Describe what you're building and AI will suggest work items.</p>
                <textarea
                  className="w-full rounded-md bg-background px-3 py-2 text-sm focus:outline-none resize-none h-24"
                  style={{ border: "1.5px solid var(--border-strong)", boxShadow: "2px 2px 0 var(--riso-violet)" }}
                  value={suggestContext}
                  onChange={(e) => setSuggestContext(e.target.value)}
                  placeholder="e.g. A mobile app for tracking workouts with social features…"
                />
                <DialogFooter>
                  <button className="btn-tactile btn-tactile-outline" onClick={() => setSuggestOpen(false)}>Cancel</button>
                  <button className="btn-tactile btn-tactile-violet gap-1" onClick={handleSuggestTasks} disabled={suggestLoading}>
                    <Sparkles size={12} />
                    {suggestLoading ? "Thinking…" : "Suggest Items"}
                  </button>
                </DialogFooter>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Click to add items to your project:</p>
                <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
                  {suggestedTasks.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => handleAddSuggestedTask(t)}
                      className="flex items-start gap-3 text-left p-3.5 transition-all duration-100"
                      style={{
                        borderRadius: "6px",
                        border: "1.5px solid rgba(20,16,10,0.16)",
                        boxShadow: "2px 2px 0 var(--riso-teal)",
                        background: "var(--card)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "3px 3px 0 var(--riso-teal)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = "";
                        (e.currentTarget as HTMLElement).style.boxShadow = "2px 2px 0 var(--riso-teal)";
                      }}
                    >
                      <Plus size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent-teal)" }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono-ui mt-0.5">
                          {t.item_type}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <DialogFooter>
                  <button className="btn-tactile btn-tactile-outline" onClick={() => { setSuggestedTasks([]); setSuggestContext(""); }}>Back</button>
                  <button className="btn-tactile btn-tactile-teal" onClick={() => { setSuggestOpen(false); setSuggestedTasks([]); setSuggestContext(""); }}>Done</button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete task confirmation */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(o) => { if (!o) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm surface-noise" style={{ border: "1.5px solid var(--border-strong)" }}>
          <DialogHeader>
            <DialogTitle className="font-display font-black tracking-tight">Delete Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This will permanently delete this item and its children. This action cannot be undone.
          </p>
          <DialogFooter>
            <button className="btn-tactile btn-tactile-outline" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
            <button
              className="btn-tactile gap-1"
              style={{ background: "var(--destructive)", backgroundImage: "var(--noise-btn)", borderColor: "rgba(0,0,0,0.15)", color: "#fff" }}
              onClick={confirmTaskDelete}
            >Delete</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
