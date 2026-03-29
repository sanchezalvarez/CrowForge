import { useState, useEffect, useRef } from "react";
import { X, Trash2, Plus, ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";
import axios from "axios";
import { PMTask, PMTaskStatus, PMPriority, PMItemType, PMMember, PMSprint, PMActivity, PMRef } from "../../types/pm";
import { StatusBadge } from "./StatusBadge";
import { PriorityBadge } from "./PriorityBadge";
import { WorkItemTypeBadge } from "./WorkItemTypeBadge";
import { MemberAvatar } from "./MemberAvatar";
import { DeadlineWarning } from "./DeadlineWarning";
import { TaskRefs } from "./TaskRefs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const API_BASE = "http://127.0.0.1:8000";
const FIBONACCI = [1, 2, 3, 5, 8, 13, 21];

// Valid parent types for each item type
const VALID_PARENT_TYPES: Record<PMItemType, PMItemType[]> = {
  epic:    [],
  feature: ["epic"],
  story:   ["feature"],
  task:    ["story"],
  bug:     ["story"],
  spike:   ["story"],
};

interface TaskDetailPanelProps {
  task: PMTask | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: number, data: Partial<PMTask>) => Promise<PMTask | null>;
  onDelete: (id: number) => Promise<void>;
  members: PMMember[];
  sprints: PMSprint[];
  allTasks?: PMTask[];
  onNavigate?: (page: string, id?: string) => void;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function TaskDetailPanel({ task, open, onClose, onUpdate, onDelete, members, sprints, allTasks = [], onNavigate }: TaskDetailPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [activity, setActivity] = useState<PMActivity[]>([]);
  const [children, setChildren] = useState<PMTask[]>([]);
  const [newChild, setNewChild] = useState("");
  const [showChildInput, setShowChildInput] = useState(false);
  const [childrenExpanded, setChildrenExpanded] = useState(true);
  const [parentTask, setParentTask] = useState<PMTask | null>(null);
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [parentPickerSearch, setParentPickerSearch] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setAcceptanceCriteria(task.acceptance_criteria ?? "");
      loadActivity(task.id);
      loadChildren(task.id);
      if (task.parent_id) loadParent(task.parent_id);
      else setParentTask(null);
    }
  }, [task?.id]);

  const loadActivity = async (taskId: number) => {
    try {
      const res = await axios.get(`${API_BASE}/pm/activity`, {
        params: { project_id: task?.project_id, limit: 20 },
      });
      setActivity(res.data.filter((a: PMActivity) => a.task_id === taskId));
    } catch {}
  };

  const loadChildren = async (parentId: number) => {
    try {
      const res = await axios.get(`${API_BASE}/pm/tasks`, { params: { parent_id: parentId } });
      setChildren(res.data);
    } catch {}
  };

  const loadParent = async (parentId: number) => {
    try {
      const res = await axios.get(`${API_BASE}/pm/tasks/${parentId}`);
      setParentTask(res.data);
    } catch {}
  };

  const handleBlurTitle = async () => {
    if (!task || title === task.title) return;
    if (!title.trim()) { setTitle(task.title); return; }
    await onUpdate(task.id, { title: title.trim() });
  };

  const handleBlurDescription = async () => {
    if (!task || description === task.description) return;
    await onUpdate(task.id, { description });
  };

  const handleBlurAC = async () => {
    if (!task || acceptanceCriteria === (task.acceptance_criteria ?? "")) return;
    await onUpdate(task.id, { acceptance_criteria: acceptanceCriteria });
  };

  const defaultChildType = (parentType: string): string => {
    if (parentType === "epic") return "feature";
    if (parentType === "feature") return "story";
    return "task";
  };

  const handleAddChild = async () => {
    if (!task || !newChild.trim()) return;
    try {
      await axios.post(`${API_BASE}/pm/tasks`, {
        project_id: task.project_id,
        parent_id: task.id,
        title: newChild.trim(),
        item_type: defaultChildType(task.item_type),
        status: "new",
        priority: "medium",
      });
      setNewChild("");
      setShowChildInput(false);
      await loadChildren(task.id);
    } catch {}
  };

  const handleChildToggle = async (child: PMTask) => {
    const newStatus: PMTaskStatus = child.status === "closed" ? "new" : "closed";
    try {
      await axios.patch(`${API_BASE}/pm/tasks/${child.id}`, { status: newStatus });
      setChildren((prev) => prev.map((c) => (c.id === child.id ? { ...c, status: newStatus } : c)));
    } catch {}
  };

  // Parent picker
  const validParentTypes = task ? VALID_PARENT_TYPES[task.item_type] : [];
  const parentCandidates = allTasks.filter((t) => {
    if (!task) return false;
    if (t.id === task.id) return false;
    if (!validParentTypes.includes(t.item_type)) return false;
    if (parentPickerSearch && !t.title.toLowerCase().includes(parentPickerSearch.toLowerCase())) return false;
    return true;
  });

  const handleSelectParent = async (newParentId: number | null) => {
    if (!task) return;
    await onUpdate(task.id, { parent_id: newParentId });
    if (newParentId) loadParent(newParentId);
    else setParentTask(null);
    setParentPickerOpen(false);
  };

  const handleRefsChange = async (refs: PMRef[]) => {
    if (!task) return;
    await onUpdate(task.id, { refs });
  };

  if (!task) return null;

  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));
  const assignee = task.assignee_id ? memberMap[task.assignee_id] : null;
  const showAC = task.item_type === "story" || !!acceptanceCriteria;
  const canHaveParent = validParentTypes.length > 0;

  return (
    <>
      <div
        className={`fixed inset-x-0 bottom-0 z-40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ top: 32, background: "rgba(0,0,0,0.25)" }}
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-8 bg-background border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300"
        style={{ width: 440, height: "calc(100% - 32px)", transform: open ? "translateX(0)" : "translateX(100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <WorkItemTypeBadge type={task.item_type} />
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDelete(task.id); onClose(); }}
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Breadcrumb */}
          {parentTask && (
            <div className="px-4 pt-3 pb-0">
              <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                <WorkItemTypeBadge type={parentTask.item_type} />
                <span className="truncate">{parentTask.title}</span>
                <ChevronRight size={9} />
                <WorkItemTypeBadge type={task.item_type} />
              </span>
            </div>
          )}

          {/* Title */}
          <div className="px-4 pt-3 pb-2">
            <input
              ref={titleRef}
              className="w-full text-base font-semibold bg-transparent border-none outline-none focus:ring-0 text-foreground"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleBlurTitle}
              onKeyDown={(e) => { if (e.key === "Enter") titleRef.current?.blur(); }}
            />
          </div>

          {/* Metadata grid */}
          <div className="px-4 py-2 grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 text-sm border-b border-border pb-4">
            <span className="text-muted-foreground text-xs font-mono pt-1">Type</span>
            <Select value={task.item_type} onValueChange={(v) => onUpdate(task.id, { item_type: v as PMItemType })}>
              <SelectTrigger className="h-7 text-xs border-0 bg-muted px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="epic">Epic</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="story">Story</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="spike">Spike</SelectItem>
              </SelectContent>
            </Select>

            {/* Parent row */}
            {canHaveParent && (
              <>
                <span className="text-muted-foreground text-xs font-mono pt-1">Parent</span>
                <div className="relative flex items-center gap-1">
                  <div className="flex-1 flex items-center gap-1 min-w-0">
                    {parentTask ? (
                      <>
                        <WorkItemTypeBadge type={parentTask.item_type} />
                        <span className="text-xs truncate max-w-[140px]">{parentTask.title}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">— none —</span>
                    )}
                  </div>
                  <button
                    onClick={() => setParentPickerOpen((v) => !v)}
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    title="Change parent"
                  >
                    <ChevronsUpDown size={12} />
                  </button>
                  {parentPickerOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-background border border-border rounded-md shadow-lg">
                      <div className="p-1.5">
                        <input
                          autoFocus
                          className="w-full text-xs border border-border rounded px-2 py-1 bg-muted focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Search tasks…"
                          value={parentPickerSearch}
                          onChange={(e) => setParentPickerSearch(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Escape") setParentPickerOpen(false); }}
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {task.parent_id && (
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors italic"
                            onClick={() => handleSelectParent(null)}
                          >
                            Remove parent (make root)
                          </button>
                        )}
                        {parentCandidates.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            No valid parent {validParentTypes.join("/")} items found.
                          </p>
                        ) : (
                          parentCandidates.map((t) => (
                            <button
                              key={t.id}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors flex items-center gap-1.5"
                              onClick={() => handleSelectParent(t.id)}
                            >
                              <WorkItemTypeBadge type={t.item_type} />
                              <span className="truncate">{t.title}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <span className="text-muted-foreground text-xs font-mono pt-1">Status</span>
            <Select value={task.status} onValueChange={(v) => onUpdate(task.id, { status: v as PMTaskStatus })}>
              <SelectTrigger className="h-7 text-xs border-0 bg-muted px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-muted-foreground text-xs font-mono pt-1">Priority</span>
            <Select value={task.priority} onValueChange={(v) => onUpdate(task.id, { priority: v as PMPriority })}>
              <SelectTrigger className="h-7 text-xs border-0 bg-muted px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <span className="text-muted-foreground text-xs font-mono pt-1">Story Pts</span>
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {FIBONACCI.map((n) => (
                <button
                  key={n}
                  onClick={() => onUpdate(task.id, { story_points: task.story_points === n ? null : n })}
                  className={`text-[11px] font-mono rounded px-2 py-0.5 border transition-colors ${
                    task.story_points === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {n}
                </button>
              ))}
              {task.story_points != null && (
                <button
                  onClick={() => onUpdate(task.id, { story_points: null })}
                  className="text-[10px] text-muted-foreground hover:text-foreground font-mono ml-1"
                >
                  clear
                </button>
              )}
            </div>

            <span className="text-muted-foreground text-xs font-mono pt-1">Assignee</span>
            <div className="flex items-center gap-2">
              <MemberAvatar member={assignee} size="sm" />
              <Select
                value={task.assignee_id?.toString() ?? "none"}
                onValueChange={(v) => onUpdate(task.id, { assignee_id: v !== "none" ? parseInt(v) : null })}
              >
                <SelectTrigger className="h-7 text-xs border-0 bg-muted px-2 flex-1">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="text-muted-foreground text-xs font-mono pt-1">Due</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="rounded border border-border bg-muted px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                value={task.due_date ?? ""}
                onChange={(e) => onUpdate(task.id, { due_date: e.target.value || null })}
              />
              <DeadlineWarning dueDate={task.due_date} status={task.status} />
            </div>

            <span className="text-muted-foreground text-xs font-mono pt-1">Sprint</span>
            <Select
              value={task.sprint_id?.toString() ?? "none"}
              onValueChange={(v) => onUpdate(task.id, { sprint_id: v !== "none" ? parseInt(v) : null })}
            >
              <SelectTrigger className="h-7 text-xs border-0 bg-muted px-2">
                <SelectValue placeholder="Backlog" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Backlog</SelectItem>
                {sprints.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {task.labels && task.labels.length > 0 && (
              <>
                <span className="text-muted-foreground text-xs font-mono pt-1">Labels</span>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {task.labels.map((l) => (
                    <span key={l} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground border border-border font-mono">
                      {l}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Description */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs text-muted-foreground font-mono mb-1.5">Description</p>
            <Textarea
              className="text-sm resize-none border-0 bg-muted focus:ring-1 focus:ring-primary min-h-[80px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleBlurDescription}
              placeholder="Add a description…"
            />
          </div>

          {/* Acceptance Criteria (stories) */}
          {showAC && (
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs text-muted-foreground font-mono mb-1.5">Acceptance Criteria</p>
              <Textarea
                className="text-sm resize-none border-0 bg-muted focus:ring-1 focus:ring-primary min-h-[60px]"
                value={acceptanceCriteria}
                onChange={(e) => setAcceptanceCriteria(e.target.value)}
                onBlur={handleBlurAC}
                placeholder="Given / When / Then…"
              />
            </div>
          )}

          {/* References */}
          <TaskRefs
            refs={task.refs ?? []}
            onChange={handleRefsChange}
            onNavigate={onNavigate}
          />

          {/* Children */}
          <div className="px-4 py-3 border-b border-border">
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground font-mono mb-2 hover:text-foreground transition-colors"
              onClick={() => setChildrenExpanded((v) => !v)}
            >
              {childrenExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Child Items ({children.filter((c) => c.status === "closed" || c.status === "resolved").length}/{children.length})
            </button>
            {childrenExpanded && (
              <div className="flex flex-col gap-1">
                {children.map((child) => (
                  <div key={child.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={child.status === "closed" || child.status === "resolved"}
                      onChange={() => handleChildToggle(child)}
                      className="rounded border-border accent-primary"
                    />
                    <WorkItemTypeBadge type={child.item_type} />
                    <span className={`text-sm flex-1 ${child.status === "closed" ? "line-through text-muted-foreground" : ""}`}>
                      {child.title}
                    </span>
                  </div>
                ))}
                {showChildInput ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      autoFocus
                      className="flex-1 text-sm border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      value={newChild}
                      onChange={(e) => setNewChild(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddChild();
                        if (e.key === "Escape") { setShowChildInput(false); setNewChild(""); }
                      }}
                      placeholder="Child item title…"
                    />
                    <Button size="sm" variant="ghost" onClick={handleAddChild}>Add</Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowChildInput(true)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                  >
                    <Plus size={11} /> Add child item
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground font-mono mb-2">Activity</p>
            {activity.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {activity.map((a) => (
                  <div key={a.id} className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-foreground">{a.detail}</span>
                      <span className="text-[10px] text-muted-foreground ml-2 font-mono">{timeAgo(a.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
