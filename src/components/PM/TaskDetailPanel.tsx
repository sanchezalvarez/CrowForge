import { useState, useEffect, useRef, useCallback, type ComponentPropsWithoutRef } from "react";
import { timeAgo } from "../../lib/pmUtils";
import ReactMarkdown from "react-markdown";
import { X, Trash2, ChevronRight, ChevronsUpDown, ImagePlus, Youtube, Loader2 } from "lucide-react";
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
import { Textarea } from "../ui/textarea";
import { toast } from "../../hooks/useToast";

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

// timeAgo imported from pmUtils

// ── Markdown components for description preview ──────────────────────────────

function MdImg({ src, alt }: ComponentPropsWithoutRef<"img">) {
  return (
    <img
      src={src}
      alt={alt || ""}
      className="max-w-full rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity my-1"
      style={{ maxHeight: 280 }}
      onClick={() => src && window.open(src, "_blank", "noopener,noreferrer")}
    />
  );
}

function MdAnchor({ href, children }: ComponentPropsWithoutRef<"a">) {
  const ytMatch = href?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return (
      <div className="my-2 rounded-lg overflow-hidden border border-border" style={{ maxWidth: 380, aspectRatio: "16/9" }}>
        <iframe
          src={`https://www.youtube.com/embed/${ytMatch[1]}`}
          className="w-full h-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title="YouTube video"
        />
      </div>
    );
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>;
}

const MD_COMPONENTS = { img: MdImg, a: MdAnchor };

// ── DescriptionField ──────────────────────────────────────────────────────────

function DescriptionField({ value, onChange, onBlur }: { value: string; onChange: (v: string) => void; onBlur: () => void }) {
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState({ done: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const startEdit = useCallback(() => {
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 10);
  }, []);

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close edit mode if focus moves to toolbar buttons inside the field
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
    setEditing(false);
    onBlur();
  };

  const insertAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      onChange(valueRef.current + text);
      return;
    }
    const start = ta.selectionStart ?? valueRef.current.length;
    const end = ta.selectionEnd ?? valueRef.current.length;
    const newVal = valueRef.current.slice(0, start) + text + valueRef.current.slice(end);
    onChange(newVal);
    setTimeout(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }, [onChange]);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  const uploadFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    setUploading(true);
    setUploadCount({ done: 0, total: imageFiles.length });
    for (let i = 0; i < imageFiles.length; i++) {
      if (imageFiles[i].size > MAX_FILE_SIZE) {
        toast(`"${imageFiles[i].name}" is too large (max 5 MB)`, "error");
        setUploadCount({ done: i + 1, total: imageFiles.length });
        continue;
      }
      try {
        const formData = new FormData();
        formData.append("file", imageFiles[i]);
        const res = await axios.post(`${API_BASE}/pm/files/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const url: string = res.data.url;
        const alt = imageFiles[i].name.replace(/\.[^.]+$/, "") || "image";
        insertAtCursor(`\n![${alt}](${url})\n`);
      } catch {
        // skip failed upload silently
      }
      setUploadCount({ done: i + 1, total: imageFiles.length });
    }
    setUploading(false);
  }, [insertAtCursor]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    uploadFiles(files);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItems = Array.from(e.clipboardData.items).filter(i => i.type.startsWith("image/"));
    if (imageItems.length > 0) {
      e.preventDefault();
      uploadFiles(imageItems.map(i => i.getAsFile()!).filter(Boolean));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  };

  const handleYouTube = () => {
    const url = prompt("YouTube URL:");
    if (!url?.trim()) return;
    insertAtCursor(`\n[▶ YouTube](${url.trim()})\n`);
  };

  return (
    <div className="px-4 py-3 border-b border-border">
      <p className="text-xs text-muted-foreground font-mono mb-1.5">Description</p>

      {editing ? (
        <div
          className="flex flex-col gap-1.5"
          onBlur={handleBlur}
        >
          {/* Toolbar */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              tabIndex={0}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5 hover:bg-muted transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={9} className="animate-spin" /> : <ImagePlus size={9} />}
              {uploading ? `Uploading ${uploadCount.done}/${uploadCount.total}…` : "Add image"}
            </button>
            <button
              type="button"
              tabIndex={0}
              onClick={handleYouTube}
              className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5 hover:bg-muted transition-colors"
            >
              <Youtube size={9} /> YouTube
            </button>
          </div>

          {/* Textarea */}
          <div
            className={`relative rounded-md transition-colors ${dragOver ? "ring-2 ring-primary bg-primary/5" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <textarea
              ref={textareaRef}
              className="w-full text-sm resize-none rounded-md border-0 bg-muted px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary min-h-[120px]"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onPaste={handlePaste}
              placeholder={dragOver ? "Drop images here…" : "Add a description… (markdown, paste or drag images)"}
            />
            {dragOver && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-md">
                <span className="text-xs text-primary font-medium bg-background/80 px-3 py-1.5 rounded-full border border-primary/30">
                  Drop images here
                </span>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      ) : (
        <div
          className="cursor-text min-h-[40px] rounded-md bg-muted/50 px-3 py-2 hover:bg-muted transition-colors"
          onClick={startEdit}
        >
          {value ? (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&_a]:text-primary [&_a]:underline">
              <ReactMarkdown components={MD_COMPONENTS}>{value}</ReactMarkdown>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground/60">Add a description… (supports images &amp; YouTube)</span>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskDetailPanel({ task, open, onClose, onUpdate, onDelete, members, sprints, allTasks = [], onNavigate }: TaskDetailPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [activity, setActivity] = useState<PMActivity[]>([]);
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
                <SelectItem value="ready_to_go">Ready to Go</SelectItem>
                <SelectItem value="needs_testing">Needs Testing</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
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
          <DescriptionField
            value={description}
            onChange={setDescription}
            onBlur={handleBlurDescription}
          />

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
